from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import hashlib
import secrets
import jwt
from passlib.context import CryptContext
from email_service import get_email_service

# Import all models
from models import *
from course_service import CourseService

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Get email service instance
email_service = get_email_service()

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Initialize course service
course_service = CourseService(db)

# Create the main app without a prefix
app = FastAPI(title="Schulungsportal API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security setup
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
SECRET_KEY = os.environ.get("SECRET_KEY", "schulungsportal-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Utility functions
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def generate_access_key() -> str:
    """Generate a secure random access key"""
    return secrets.token_urlsafe(16)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        access_key: str = payload.get("sub")
        if access_key is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials"
            )
        return access_key
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )

async def get_current_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        admin_email: str = payload.get("admin_email")
        if admin_email is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid admin credentials"
            )
        admin = await db.admins.find_one({"email": admin_email})
        if not admin or not admin.get("is_active"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Admin not found or inactive"
            )
        return Admin(**admin)
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin credentials"
        )

# Routes

@api_router.get("/")
async def root():
    return {"message": "Schulungsportal API", "version": "2.0"}

# Access Key Validation
@api_router.post("/validate-key", response_model=AccessKeyValidation)
async def validate_access_key(key_data: AccessKeyCreate):
    """Validate access key and return JWT token"""
    try:
        # Find the access key in database
        access_key_doc = await db.access_keys.find_one({
            "key": key_data.access_key,
            "is_active": True
        })
        
        if not access_key_doc:
            return AccessKeyValidation(
                success=False,
                message="Ungültiger oder inaktiver Access-Key"
            )
        
        access_key_obj = AccessKey(**access_key_doc)
        
        # Check expiration
        if access_key_obj.expires_at and access_key_obj.expires_at < datetime.now(timezone.utc):
            return AccessKeyValidation(
                success=False,
                message="Access-Key ist abgelaufen"
            )
        
        # Check usage limits
        if access_key_obj.max_usage and access_key_obj.usage_count >= access_key_obj.max_usage:
            return AccessKeyValidation(
                success=False,
                message="Access-Key hat das Nutzungslimit erreicht"
            )
        
        # Update usage count
        await db.access_keys.update_one(
            {"key": key_data.access_key},
            {"$inc": {"usage_count": 1}}
        )
        
        # Create or update user session
        user_doc = await db.users.find_one({"access_key": key_data.access_key})
        if user_doc:
            user = User(**user_doc)
            await db.users.update_one(
                {"access_key": key_data.access_key},
                {"$set": {"last_login": datetime.now(timezone.utc)}}
            )
        else:
            user = User(access_key=key_data.access_key, last_login=datetime.now(timezone.utc))
            user_dict = user.dict()
            user_dict["created_at"] = user_dict["created_at"].isoformat()
            user_dict["last_login"] = user_dict["last_login"].isoformat()
            await db.users.insert_one(user_dict)
        
        # Create JWT token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": key_data.access_key}, expires_delta=access_token_expires
        )
        
        return AccessKeyValidation(
            success=True,
            message="Access-Key erfolgreich validiert",
            token=access_token
        )
        
    except Exception as e:
        logging.error(f"Error validating access key: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Fehler bei der Validierung des Access-Keys"
        )

# User Routes (Protected)
@api_router.get("/courses", response_model=List[Course])
async def get_user_courses(current_user: str = Depends(get_current_user)):
    """Get courses accessible by current user's access key"""
    try:
        # Get user's access key details
        access_key_doc = await db.access_keys.find_one({"key": current_user})
        if not access_key_doc:
            raise HTTPException(status_code=404, detail="Access key not found")
        
        access_key = AccessKey(**access_key_doc)
        
        # Get published courses assigned to this access key
        if access_key.course_ids:
            courses = await course_service.get_courses(status=CourseStatus.published)
            # Filter courses by assigned IDs
            filtered_courses = [c for c in courses if c.id in access_key.course_ids]
            return filtered_courses
        else:
            # If no specific courses assigned, show all published courses
            return await course_service.get_courses(status=CourseStatus.published)
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting courses: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Fehler beim Laden der Kurse"
        )

@api_router.get("/courses/{course_id}", response_model=Course)
async def get_course_detail(course_id: str, current_user: str = Depends(get_current_user)):
    """Get detailed course information"""
    try:
        course = await course_service.get_course(course_id)
        if not course or course.status != CourseStatus.published:
            raise HTTPException(status_code=404, detail="Kurs nicht gefunden")
        
        # Check if user has access to this course
        access_key_doc = await db.access_keys.find_one({"key": current_user})
        if access_key_doc:
            access_key = AccessKey(**access_key_doc)
            if access_key.course_ids and course_id not in access_key.course_ids:
                raise HTTPException(status_code=403, detail="Kein Zugriff auf diesen Kurs")
        
        return course
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting course detail: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Fehler beim Laden des Kurses"
        )

@api_router.get("/courses/{course_id}/progress")
async def get_course_progress(course_id: str, current_user: str = Depends(get_current_user)):
    """Get user's progress for a course"""
    try:
        progress = await course_service.get_user_course_progress(current_user, course_id)
        return progress
    except Exception as e:
        logging.error(f"Error getting course progress: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Fehler beim Laden des Fortschritts"
        )

@api_router.post("/courses/{course_id}/modules/{module_id}/complete")
async def complete_module(course_id: str, module_id: str, current_user: str = Depends(get_current_user)):
    """Mark a module as completed"""
    try:
        success = await course_service.update_module_progress(current_user, course_id, module_id, True)
        if success:
            return {"message": "Modul erfolgreich abgeschlossen"}
        else:
            raise HTTPException(status_code=400, detail="Fehler beim Aktualisieren des Fortschritts")
    except Exception as e:
        logging.error(f"Error completing module: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Fehler beim Abschließen des Moduls"
        )

@api_router.post("/courses/{course_id}/modules/{module_id}/quiz/{quiz_id}/submit")
async def submit_quiz(
    course_id: str, 
    module_id: str, 
    quiz_id: str, 
    answers: List[Dict[str, Any]], 
    current_user: str = Depends(get_current_user)
):
    """Submit quiz answers"""
    try:
        result = await course_service.submit_quiz(current_user, course_id, module_id, quiz_id, answers)
        return result
    except Exception as e:
        logging.error(f"Error submitting quiz: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Fehler beim Einreichen des Quiz"
        )

# Admin Routes
@api_router.post("/admin/login")
async def admin_login(login_data: AdminLogin):
    """Admin login endpoint"""
    try:
        admin = await db.admins.find_one({"email": login_data.email})
        if not admin or not verify_password(login_data.password, admin["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Ungültige E-Mail oder Passwort"
            )
        
        if not admin.get("is_active", True):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Admin-Account ist deaktiviert"
            )
        
        # Create admin JWT token
        access_token_expires = timedelta(hours=8)  # Longer session for admins
        access_token = create_access_token(
            data={"admin_email": admin["email"]}, expires_delta=access_token_expires
        )
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "admin": {
                "email": admin["email"],
                "name": admin["name"]
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error during admin login: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Fehler beim Admin-Login"
        )

# Enhanced Course Management Routes
@api_router.post("/admin/courses", response_model=Course)
async def create_course(course: CourseCreate, current_admin: Admin = Depends(get_current_admin)):
    """Create a new course (Admin only)"""
    try:
        new_course = await course_service.create_course(course, current_admin.email)
        return new_course
    except Exception as e:
        logging.error(f"Error creating course: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Fehler beim Erstellen des Kurses"
        )

@api_router.get("/admin/courses", response_model=List[Course])
async def get_all_courses(
    status: Optional[CourseStatus] = None, 
    current_admin: Admin = Depends(get_current_admin)
):
    """Get all courses (Admin only)"""
    try:
        courses = await course_service.get_courses(status=status)
        return courses
    except Exception as e:
        logging.error(f"Error getting admin courses: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Fehler beim Laden der Kurse"
        )

@api_router.get("/admin/courses/{course_id}", response_model=Course)
async def get_admin_course(course_id: str, current_admin: Admin = Depends(get_current_admin)):
    """Get a specific course for editing (Admin only)"""
    try:
        course = await course_service.get_course(course_id)
        if not course:
            raise HTTPException(status_code=404, detail="Kurs nicht gefunden")
        return course
    except Exception as e:
        logging.error(f"Error getting admin course: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Fehler beim Laden des Kurses"
        )

@api_router.put("/admin/courses/{course_id}", response_model=Course)
async def update_course(
    course_id: str, 
    course_update: CourseUpdate, 
    current_admin: Admin = Depends(get_current_admin)
):
    """Update a course (Admin only)"""
    try:
        updated_course = await course_service.update_course(course_id, course_update)
        if not updated_course:
            raise HTTPException(status_code=404, detail="Kurs nicht gefunden")
        return updated_course
    except Exception as e:
        logging.error(f"Error updating course: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Fehler beim Aktualisieren des Kurses"
        )

@api_router.delete("/admin/courses/{course_id}")
async def delete_course(course_id: str, current_admin: Admin = Depends(get_current_admin)):
    """Delete a course (Admin only)"""
    try:
        success = await course_service.delete_course(course_id)
        if not success:
            raise HTTPException(status_code=404, detail="Kurs nicht gefunden")
        return {"message": "Kurs erfolgreich gelöscht"}
    except Exception as e:
        logging.error(f"Error deleting course: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Fehler beim Löschen des Kurses"
        )

@api_router.post("/admin/courses/{course_id}/publish")
async def publish_course(course_id: str, current_admin: Admin = Depends(get_current_admin)):
    """Publish a course (Admin only)"""
    try:
        course = await course_service.publish_course(course_id)
        if not course:
            raise HTTPException(status_code=404, detail="Kurs nicht gefunden")
        return {"message": "Kurs erfolgreich veröffentlicht", "course": course}
    except Exception as e:
        logging.error(f"Error publishing course: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Fehler beim Veröffentlichen des Kurses"
        )

@api_router.post("/admin/courses/{course_id}/unpublish")
async def unpublish_course(course_id: str, current_admin: Admin = Depends(get_current_admin)):
    """Unpublish a course (Admin only)"""
    try:
        course = await course_service.unpublish_course(course_id)
        if not course:
            raise HTTPException(status_code=404, detail="Kurs nicht gefunden")
        return {"message": "Kurs als Entwurf gesetzt", "course": course}
    except Exception as e:
        logging.error(f"Error unpublishing course: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Fehler beim Entveröffentlichen des Kurses"
        )

# Module Management Routes
@api_router.post("/admin/courses/{course_id}/modules", response_model=CourseModule)
async def add_module(
    course_id: str, 
    module: ModuleCreate, 
    current_admin: Admin = Depends(get_current_admin)
):
    """Add a module to a course (Admin only)"""
    try:
        new_module = await course_service.add_module(course_id, module)
        if not new_module:
            raise HTTPException(status_code=404, detail="Kurs nicht gefunden")
        return new_module
    except Exception as e:
        logging.error(f"Error adding module: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Fehler beim Hinzufügen des Moduls"
        )

@api_router.put("/admin/courses/{course_id}/modules/{module_id}")
async def update_module(
    course_id: str,
    module_id: str,
    module_update: ModuleUpdate,
    current_admin: Admin = Depends(get_current_admin)
):
    """Update a module (Admin only)"""
    try:
        success = await course_service.update_module(course_id, module_id, module_update)
        if not success:
            raise HTTPException(status_code=404, detail="Modul nicht gefunden")
        return {"message": "Modul erfolgreich aktualisiert"}
    except Exception as e:
        logging.error(f"Error updating module: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Fehler beim Aktualisieren des Moduls"
        )

@api_router.delete("/admin/courses/{course_id}/modules/{module_id}")
async def delete_module(
    course_id: str,
    module_id: str,
    current_admin: Admin = Depends(get_current_admin)
):
    """Delete a module (Admin only)"""
    try:
        success = await course_service.delete_module(course_id, module_id)
        if not success:
            raise HTTPException(status_code=404, detail="Modul nicht gefunden")
        return {"message": "Modul erfolgreich gelöscht"}
    except Exception as e:
        logging.error(f"Error deleting module: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Fehler beim Löschen des Moduls"
        )

@api_router.post("/admin/courses/{course_id}/modules/reorder")
async def reorder_modules(
    course_id: str,
    module_orders: List[Dict[str, Any]],
    current_admin: Admin = Depends(get_current_admin)
):
    """Reorder modules in a course (Admin only)"""
    try:
        success = await course_service.reorder_modules(course_id, module_orders)
        if not success:
            raise HTTPException(status_code=404, detail="Kurs nicht gefunden")
        return {"message": "Module erfolgreich neu angeordnet"}
    except Exception as e:
        logging.error(f"Error reordering modules: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Fehler beim Neuanordnen der Module"
        )

# Email Routes
@api_router.post("/admin/send-access-keys")
async def send_access_keys_email(
    request: BulkEmailRequest,
    current_admin: Admin = Depends(get_current_admin)
):
    """Generate and send access keys via email (Admin only)"""
    try:
        if len(request.recipients) > 50:  # Limit bulk generation
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximal 50 E-Mails auf einmal versendbar"
            )
        
        count = request.count or len(request.recipients)
        
        if count != len(request.recipients):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Anzahl der Keys muss mit Anzahl der Empfänger übereinstimmen"
            )
        
        expires_at = None
        if request.expires_days:
            expires_at = datetime.now(timezone.utc) + timedelta(days=request.expires_days)
        
        generated_keys = []
        recipients_data = []
        
        # Generate keys and store in database
        for recipient in request.recipients:
            key = generate_access_key()
            access_key = AccessKey(
                key=key,
                expires_at=expires_at,
                max_usage=request.max_usage,
                course_ids=request.course_ids,
                created_by=current_admin.email
            )
            
            access_key_dict = access_key.dict()
            access_key_dict["created_at"] = access_key_dict["created_at"].isoformat()
            if access_key_dict["expires_at"]:
                access_key_dict["expires_at"] = access_key_dict["expires_at"].isoformat()
            
            await db.access_keys.insert_one(access_key_dict)
            
            generated_keys.append(key)
            recipients_data.append({
                "email": recipient.email,
                "name": recipient.name or ""
            })
        
        # Send emails
        email_results = email_service.send_bulk_access_keys(recipients_data, generated_keys)
        
        return {
            "success": True,
            "message": f"Access-Keys erfolgreich generiert und versendet",
            "email_results": email_results,
            "generated_keys_count": len(generated_keys)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error sending access key emails: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Fehler beim Versenden der Access-Key E-Mails"
        )

@api_router.post("/admin/send-single-key")
async def send_single_access_key(
    request: dict,
    current_admin: Admin = Depends(get_current_admin)
):
    """Generate and send a single access key via email (Admin only)"""
    try:
        email_request = EmailRequest(
            email=request.get("email"),
            name=request.get("name", "")
        )
        
        expires_at = None
        if request.get("expires_days"):
            expires_at = datetime.now(timezone.utc) + timedelta(days=request.get("expires_days"))
        
        # Generate key
        key = generate_access_key()
        access_key = AccessKey(
            key=key,
            expires_at=expires_at,
            max_usage=request.get("max_usage"),
            course_ids=request.get("course_ids", []),
            created_by=current_admin.email
        )
        
        access_key_dict = access_key.dict()
        access_key_dict["created_at"] = access_key_dict["created_at"].isoformat()
        if access_key_dict["expires_at"]:
            access_key_dict["expires_at"] = access_key_dict["expires_at"].isoformat()
        
        await db.access_keys.insert_one(access_key_dict)
        
        # Send email
        success = email_service.send_access_key_email(
            email_request.email, 
            key, 
            email_request.name or ""
        )
        
        if success:
            return {
                "success": True,
                "message": f"Access-Key erfolgreich an {email_request.email} versendet",
                "access_key": key
            }
        else:
            # Key was created but email failed - we could delete it here
            await db.access_keys.delete_one({"key": key})
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Access-Key generiert, aber E-Mail-Versendung fehlgeschlagen"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error sending single access key email: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Fehler beim Generieren und Versenden des Access-Keys"
        )

@api_router.get("/admin/access-keys")
async def get_access_keys(current_admin: Admin = Depends(get_current_admin)):
    """Get all access keys (Admin only)"""
    try:
        keys = await db.access_keys.find().to_list(length=None)
        return [AccessKey(**key) for key in keys]
        
    except Exception as e:
        logging.error(f"Error getting access keys: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Fehler beim Laden der Access-Keys"
        )

@api_router.get("/admin/access-keys")
async def get_access_keys(current_admin: Admin = Depends(get_current_admin)):
    """Get all access keys (Admin only)"""
    try:
        keys = await db.access_keys.find().sort("created_at", -1).to_list(length=None)
        return [AccessKey(**key) for key in keys]
        
    except Exception as e:
        logging.error(f"Error getting access keys: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Fehler beim Laden der Access-Keys"
        )

@api_router.patch("/admin/access-keys/{key_id}")
async def update_access_key_status(
    key_id: str, 
    update_data: dict,
    current_admin: Admin = Depends(get_current_admin)
):
    """Update access key status (Admin only)"""
    try:
        result = await db.access_keys.update_one(
            {"id": key_id},
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Access-Key nicht gefunden")
            
        return {"message": "Access-Key erfolgreich aktualisiert"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating access key: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Fehler beim Aktualisieren des Access-Keys"
        )

@api_router.delete("/admin/access-keys/{key_id}")
async def delete_access_key(
    key_id: str,
    current_admin: Admin = Depends(get_current_admin)
):
    """Delete access key (Admin only)"""
    try:
        result = await db.access_keys.delete_one({"id": key_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Access-Key nicht gefunden")
            
        return {"message": "Access-Key erfolgreich gelöscht"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting access key: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Fehler beim Löschen des Access-Keys"
        )

@api_router.get("/admin/users")
async def get_users(current_admin: Admin = Depends(get_current_admin)):
    """Get all users (Admin only)"""
    try:
        users = await db.users.find().sort("last_login", -1).to_list(length=None)
        return [User(**user) for user in users]
        
    except Exception as e:
        logging.error(f"Error getting users: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Fehler beim Laden der Benutzer"
        )

@api_router.get("/admin/statistics")
async def get_admin_statistics(current_admin: Admin = Depends(get_current_admin)):
    """Get admin dashboard statistics"""
    try:
        # Access keys statistics
        total_keys = await db.access_keys.count_documents({})
        active_keys = await db.access_keys.count_documents({"is_active": True})
        
        # Users statistics  
        total_users = await db.users.count_documents({})
        
        # Courses statistics
        total_courses = await db.courses.count_documents({})
        published_courses = await db.courses.count_documents({"status": "published"})
        
        # Usage statistics
        total_usage = await db.access_keys.aggregate([
            {"$group": {"_id": None, "total": {"$sum": "$usage_count"}}}
        ]).to_list(1)
        
        total_usage_count = total_usage[0]["total"] if total_usage else 0
        
        # Recent activity (last 7 days)
        week_ago = datetime.now(timezone.utc) - timedelta(days=7)
        recent_keys = await db.access_keys.count_documents({
            "created_at": {"$gte": week_ago.isoformat()}
        })
        
        recent_users = await db.users.count_documents({
            "last_login": {"$gte": week_ago.isoformat()}
        })
        
        return {
            "access_keys": {
                "total": total_keys,
                "active": active_keys,
                "recent": recent_keys
            },
            "users": {
                "total": total_users,
                "recent_active": recent_users
            },
            "courses": {
                "total": total_courses,
                "published": published_courses
            },
            "usage": {
                "total_usage": total_usage_count
            }
        }
        
    except Exception as e:
        logging.error(f"Error getting statistics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Fehler beim Laden der Statistiken"
        )

# Debug Routes
@api_router.get("/debug/reset-admin")
async def debug_reset_admin():
    """Debug endpoint to reset admin password"""
    try:
        # Delete existing admin
        await db.admins.delete_one({"email": "admin@schulungsportal.de"})
        
        # Create new admin
        default_admin = Admin(
            email="admin@schulungsportal.de",
            password_hash=hash_password("admin123"),
            name="Administrator"
        )
        admin_dict = default_admin.dict()
        admin_dict["created_at"] = admin_dict["created_at"].isoformat()
        
        await db.admins.insert_one(admin_dict)
        return {"message": "Admin reset successfully", "admin_email": "admin@schulungsportal.de", "password": "admin123"}
        
    except Exception as e:
        return {"error": str(e)}

@api_router.get("/debug/create-admin")
async def debug_create_admin():
    """Debug endpoint to create admin user"""
    try:
        # Check if admin exists
        admin = await db.admins.find_one({"email": "admin@schulungsportal.de"})
        if admin:
            return {"message": "Admin already exists", "admin_email": "admin@schulungsportal.de"}
        
        # Create admin
        default_admin = Admin(
            email="admin@schulungsportal.de",
            password_hash=hash_password("admin123"),
            name="Administrator"
        )
        admin_dict = default_admin.dict()
        admin_dict["created_at"] = admin_dict["created_at"].isoformat()
        
        await db.admins.insert_one(admin_dict)
        return {"message": "Admin created successfully", "admin_email": "admin@schulungsportal.de", "password": "admin123"}
        
    except Exception as e:
        return {"error": str(e)}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# Initialize admin user on startup
@app.on_event("startup")
async def create_default_admin():
    try:
        # Check if any admin exists
        admin_count = await db.admins.count_documents({})
        if admin_count == 0:
            # Create default admin
            default_admin = Admin(
                email="admin@schulungsportal.de",
                password_hash=hash_password("admin123"),
                name="Administrator"
            )
            admin_dict = default_admin.dict()
            admin_dict["created_at"] = admin_dict["created_at"].isoformat()
            
            await db.admins.insert_one(admin_dict)
            logger.info("Default admin created: admin@schulungsportal.de / admin123")
            
        # Create sample access key for testing
        key_count = await db.access_keys.count_documents({})
        if key_count == 0:
            test_key = AccessKey(
                key="TEST-KEY-123",
                expires_at=datetime.now(timezone.utc) + timedelta(days=30),
                created_by="system"
            )
            key_dict = test_key.dict()
            key_dict["created_at"] = key_dict["created_at"].isoformat()
            key_dict["expires_at"] = key_dict["expires_at"].isoformat()
            
            await db.access_keys.insert_one(key_dict)
            logger.info("Test access key created: TEST-KEY-123")
            
        # Create enhanced sample course
        course_count = await db.courses.count_documents({})
        if course_count == 0:
            sample_course = Course(
                title="Beispielkurs: Grundlagen der Schulung",
                description="Ein umfassender Beispielkurs um das erweiterte System zu demonstrieren",
                short_description="Lernen Sie die Grundlagen effektiver Schulungen",
                content="""# Willkommen zum Beispielkurs

Dieser Kurs demonstriert die erweiterten Funktionen des Schulungsportals mit:
- Rich-Text-Inhalten
- Interaktiven Modulen  
- Quiz-Systemen
- Fortschrittsverfolgung

Viel Erfolg beim Lernen!""",
                status=CourseStatus.published,
                tags=["grundlagen", "schulung", "demo"],
                category="Grundlagen",
                difficulty_level="beginner",
                estimated_duration_hours=2.0,
                modules=[
                    CourseModule(
                        title="Einführung",
                        description="Grundlagen der Schulung",
                        type=ModuleType.text,
                        content=ModuleContent(
                            text_content="""<h2>Herzlich Willkommen!</h2>
<p>In diesem ersten Modul lernen Sie die <strong>Grundlagen effektiver Schulungen</strong> kennen.</p>
<p>Wir behandeln:</p>
<ul>
<li>Lernziele definieren</li>
<li>Zielgruppen verstehen</li>
<li>Inhalte strukturieren</li>
</ul>
<p>Lassen Sie uns beginnen!</p>"""
                        ),
                        order=0,
                        estimated_duration_minutes=30
                    ),
                    CourseModule(
                        title="Wissenstest",
                        description="Testen Sie Ihr Wissen",
                        type=ModuleType.quiz,
                        content=ModuleContent(
                            quiz=Quiz(
                                title="Grundlagen Quiz",
                                description="Überprüfen Sie Ihr Verständnis der Grundlagen",
                                questions=[
                                    QuizQuestion(
                                        question="Was ist der erste Schritt bei der Schulungsplanung?",
                                        type=QuestionType.single_choice,
                                        options=[
                                            QuizOption(text="Lernziele definieren", is_correct=True),
                                            QuizOption(text="Material sammeln", is_correct=False),
                                            QuizOption(text="Termine festlegen", is_correct=False)
                                        ],
                                        explanation="Lernziele bilden die Grundlage für alle weiteren Planungsschritte."
                                    )
                                ],
                                passing_score=70
                            )
                        ),
                        order=1,
                        estimated_duration_minutes=15
                    )
                ]
            )
            
            course_dict = course.dict()
            course_dict["created_at"] = course_dict["created_at"].isoformat()
            course_dict["updated_at"] = course_dict["updated_at"].isoformat()
            
            # Convert module dates
            for module in course_dict["modules"]:
                module["created_at"] = module["created_at"]
                module["updated_at"] = module["updated_at"] 
            
            await db.courses.insert_one(course_dict)
            logger.info("Enhanced sample course created")
            
    except Exception as e:
        logger.error(f"Error during startup initialization: {str(e)}")