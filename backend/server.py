from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import hashlib
import secrets
import jwt
from passlib.context import CryptContext
from email_service import email_service

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

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

# Models
class AccessKeyCreate(BaseModel):
    access_key: str

class AccessKeyValidation(BaseModel):
    success: bool
    message: str
    token: Optional[str] = None

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_token: Optional[str] = None
    access_key: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_login: Optional[datetime] = None

class AccessKey(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    key: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: Optional[datetime] = None
    usage_count: int = 0
    max_usage: Optional[int] = None
    course_ids: List[str] = []
    created_by: Optional[str] = None

class Course(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    content: str = ""
    is_published: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    modules: List[dict] = []

class Admin(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    password_hash: str
    name: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AdminLogin(BaseModel):
    email: EmailStr
    password: str

class AdminCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class EmailRequest(BaseModel):
    email: EmailStr
    name: Optional[str] = ""

class BulkEmailRequest(BaseModel):
    recipients: List[EmailRequest]
    count: Optional[int] = None
    expires_days: Optional[int] = None
    max_usage: Optional[int] = None
    course_ids: List[str] = []

class UserProgress(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_access_key: str
    course_id: str
    module_id: Optional[str] = None
    progress_percentage: float = 0.0
    completed: bool = False
    last_accessed: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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
    return {"message": "Schulungsportal API", "version": "1.0"}

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
        
        # Get courses assigned to this access key
        if access_key.course_ids:
            courses = await db.courses.find({
                "id": {"$in": access_key.course_ids},
                "is_published": True
            }).to_list(length=None)
        else:
            # If no specific courses assigned, show all published courses
            courses = await db.courses.find({"is_published": True}).to_list(length=None)
        
        return [Course(**course) for course in courses]
        
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
        course = await db.courses.find_one({"id": course_id, "is_published": True})
        if not course:
            raise HTTPException(status_code=404, detail="Kurs nicht gefunden")
        
        # Check if user has access to this course
        access_key_doc = await db.access_keys.find_one({"key": current_user})
        if access_key_doc:
            access_key = AccessKey(**access_key_doc)
            if access_key.course_ids and course_id not in access_key.course_ids:
                raise HTTPException(status_code=403, detail="Kein Zugriff auf diesen Kurs")
        
        return Course(**course)
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting course detail: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Fehler beim Laden des Kurses"
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

@api_router.post("/admin/courses", response_model=Course)
async def create_course(course: Course, current_admin: Admin = Depends(get_current_admin)):
    """Create a new course (Admin only)"""
    try:
        course_dict = course.dict()
        course_dict["created_at"] = course_dict["created_at"].isoformat()
        course_dict["updated_at"] = course_dict["updated_at"].isoformat()
        
        await db.courses.insert_one(course_dict)
        return course
        
    except Exception as e:
        logging.error(f"Error creating course: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Fehler beim Erstellen des Kurses"
        )

@api_router.get("/admin/courses", response_model=List[Course])
async def get_all_courses(current_admin: Admin = Depends(get_current_admin)):
    """Get all courses (Admin only)"""
    try:
        courses = await db.courses.find().to_list(length=None)
        return [Course(**course) for course in courses]
        
    except Exception as e:
        logging.error(f"Error getting admin courses: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Fehler beim Laden der Kurse"
        )

@api_router.post("/admin/access-keys")
async def generate_access_keys(
    count: int = 1,
    expires_days: Optional[int] = None,
    max_usage: Optional[int] = None,
    course_ids: List[str] = [],
    current_admin: Admin = Depends(get_current_admin)
):
    """Generate new access keys (Admin only)"""
    try:
        if count > 100:  # Limit batch generation
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximal 100 Keys auf einmal generierbar"
            )
        
        expires_at = None
        if expires_days:
            expires_at = datetime.now(timezone.utc) + timedelta(days=expires_days)
        
        generated_keys = []
        for _ in range(count):
            key = generate_access_key()
            access_key = AccessKey(
                key=key,
                expires_at=expires_at,
                max_usage=max_usage,
                course_ids=course_ids,
                created_by=current_admin.email
            )
            
            access_key_dict = access_key.dict()
            access_key_dict["created_at"] = access_key_dict["created_at"].isoformat()
            if access_key_dict["expires_at"]:
                access_key_dict["expires_at"] = access_key_dict["expires_at"].isoformat()
            
            await db.access_keys.insert_one(access_key_dict)
            generated_keys.append(key)
        
        return {
            "success": True,
            "message": f"{count} Access-Keys erfolgreich generiert",
            "keys": generated_keys
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error generating access keys: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Fehler beim Generieren der Access-Keys"
        )

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
        
        # Calculate count if not provided
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
    request: EmailRequest,
    expires_days: Optional[int] = None,
    max_usage: Optional[int] = None,
    course_ids: List[str] = [],
    current_admin: Admin = Depends(get_current_admin)
):
    """Generate and send a single access key via email (Admin only)"""
    try:
        expires_at = None
        if expires_days:
            expires_at = datetime.now(timezone.utc) + timedelta(days=expires_days)
        
        # Generate key
        key = generate_access_key()
        access_key = AccessKey(
            key=key,
            expires_at=expires_at,
            max_usage=max_usage,
            course_ids=course_ids,
            created_by=current_admin.email
        )
        
        access_key_dict = access_key.dict()
        access_key_dict["created_at"] = access_key_dict["created_at"].isoformat()
        if access_key_dict["expires_at"]:
            access_key_dict["expires_at"] = access_key_dict["expires_at"].isoformat()
        
        await db.access_keys.insert_one(access_key_dict)
        
        # Send email
        success = email_service.send_access_key_email(
            request.email, 
            key, 
            request.name or ""
        )
        
        if success:
            return {
                "success": True,
                "message": f"Access-Key erfolgreich an {request.email} versendet",
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
            
        # Create sample course
        course_count = await db.courses.count_documents({})
        if course_count == 0:
            sample_course = Course(
                title="Beispielkurs: Grundlagen der Schulung",
                description="Ein Beispielkurs um das System zu testen",
                content="# Willkommen zum Beispielkurs\n\nDies ist ein Beispielkurs um die Funktionalität des Schulungsportals zu demonstrieren.",
                is_published=True
            )
            course_dict = sample_course.dict()
            course_dict["created_at"] = course_dict["created_at"].isoformat()
            course_dict["updated_at"] = course_dict["updated_at"].isoformat()
            
            await db.courses.insert_one(course_dict)
            logger.info("Sample course created")
            
    except Exception as e:
        logger.error(f"Error during startup initialization: {str(e)}")