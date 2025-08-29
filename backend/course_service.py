from motor.motor_asyncio import AsyncIOMotorDatabase
from models import (
    Course, CourseCreate, CourseUpdate, CourseModule, ModuleCreate, ModuleUpdate,
    CourseProgress, ModuleProgress, Quiz, QuizAttempt, CourseStatus, ModuleType
)
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

class CourseService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        
    async def create_course(self, course_data: CourseCreate, created_by: str) -> Course:
        """Create a new course"""
        course = Course(
            **course_data.dict(),
            created_by=created_by,
            status=CourseStatus.draft
        )
        
        course_dict = course.dict()
        course_dict["created_at"] = course_dict["created_at"].isoformat()
        course_dict["updated_at"] = course_dict["updated_at"].isoformat()
        
        await self.db.courses.insert_one(course_dict)
        return course
    
    async def get_course(self, course_id: str) -> Optional[Course]:
        """Get a course by ID"""
        course_doc = await self.db.courses.find_one({"id": course_id})
        if not course_doc:
            return None
        return Course(**course_doc)
    
    async def update_course(self, course_id: str, course_data: CourseUpdate) -> Optional[Course]:
        """Update a course"""
        update_data = {k: v for k, v in course_data.dict().items() if v is not None}
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        result = await self.db.courses.update_one(
            {"id": course_id},
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            return None
            
        return await self.get_course(course_id)
    
    async def delete_course(self, course_id: str) -> bool:
        """Delete a course"""
        result = await self.db.courses.delete_one({"id": course_id})
        return result.deleted_count > 0
    
    async def get_courses(self, status: Optional[CourseStatus] = None, created_by: Optional[str] = None) -> List[Course]:
        """Get courses with optional filtering"""
        query = {}
        if status:
            query["status"] = status.value
        if created_by:
            query["created_by"] = created_by
            
        courses = await self.db.courses.find(query).sort("updated_at", -1).to_list(length=None)
        return [Course(**course) for course in courses]
    
    async def publish_course(self, course_id: str) -> Optional[Course]:
        """Publish a course"""
        return await self.update_course(course_id, CourseUpdate(status=CourseStatus.published))
    
    async def unpublish_course(self, course_id: str) -> Optional[Course]:
        """Unpublish a course (set to draft)"""
        return await self.update_course(course_id, CourseUpdate(status=CourseStatus.draft))
    
    # Module Management
    async def add_module(self, course_id: str, module_data: ModuleCreate) -> Optional[CourseModule]:
        """Add a module to a course"""
        course = await self.get_course(course_id)
        if not course:
            return None
        
        # Get the next order number
        next_order = len(course.modules)
        
        new_module = CourseModule(
            **module_data.dict(),
            order=next_order
        )
        
        # Add module to course
        module_dict = new_module.dict()
        module_dict["created_at"] = module_dict["created_at"].isoformat()
        module_dict["updated_at"] = module_dict["updated_at"].isoformat()
        
        await self.db.courses.update_one(
            {"id": course_id},
            {
                "$push": {"modules": module_dict},
                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
            }
        )
        
        return new_module
    
    async def update_module(self, course_id: str, module_id: str, module_data: ModuleUpdate) -> bool:
        """Update a module in a course"""
        update_data = {f"modules.$.{k}": v for k, v in module_data.dict().items() if v is not None}
        update_data["modules.$.updated_at"] = datetime.now(timezone.utc).isoformat()
        
        result = await self.db.courses.update_one(
            {"id": course_id, "modules.id": module_id},
            {"$set": update_data}
        )
        
        return result.modified_count > 0
    
    async def delete_module(self, course_id: str, module_id: str) -> bool:
        """Delete a module from a course"""
        result = await self.db.courses.update_one(
            {"id": course_id},
            {"$pull": {"modules": {"id": module_id}}}
        )
        
        return result.modified_count > 0
    
    async def reorder_modules(self, course_id: str, module_orders: List[Dict[str, int]]) -> bool:
        """Reorder modules in a course"""
        # module_orders should be [{"id": "module_id", "order": 0}, ...]
        course = await self.get_course(course_id)
        if not course:
            return False
        
        # Update each module's order
        for item in module_orders:
            module_id = item["id"]
            new_order = item["order"]
            
            await self.db.courses.update_one(
                {"id": course_id, "modules.id": module_id},
                {"$set": {"modules.$.order": new_order}}
            )
        
        return True
    
    # Progress Tracking
    async def update_module_progress(self, user_access_key: str, course_id: str, module_id: str, completed: bool = True, score: Optional[float] = None) -> bool:
        """Update user progress on a module"""
        progress_data = {
            "user_access_key": user_access_key,
            "course_id": course_id,
            "module_id": module_id,
            "completed": completed,
            "last_accessed": datetime.now(timezone.utc).isoformat()
        }
        
        if score is not None:
            progress_data["score"] = score
        
        if completed:
            progress_data["completed_at"] = datetime.now(timezone.utc).isoformat()
        
        # Upsert module progress
        await self.db.module_progress.update_one(
            {"user_access_key": user_access_key, "course_id": course_id, "module_id": module_id},
            {"$set": progress_data},
            upsert=True
        )
        
        # Update overall course progress
        await self._update_course_progress(user_access_key, course_id)
        
        return True
    
    async def _update_course_progress(self, user_access_key: str, course_id: str):
        """Update overall course progress"""
        # Get course and user's module progress
        course = await self.get_course(course_id)
        if not course:
            return
        
        total_modules = len(course.modules)
        if total_modules == 0:
            return
        
        # Count completed modules
        completed_count = await self.db.module_progress.count_documents({
            "user_access_key": user_access_key,
            "course_id": course_id,
            "completed": True
        })
        
        # Calculate progress percentage
        progress_percentage = (completed_count / total_modules) * 100
        
        # Get average score from completed modules
        pipeline = [
            {"$match": {
                "user_access_key": user_access_key,
                "course_id": course_id,
                "completed": True,
                "score": {"$exists": True, "$ne": None}
            }},
            {"$group": {
                "_id": None,
                "average_score": {"$avg": "$score"}
            }}
        ]
        
        avg_result = await self.db.module_progress.aggregate(pipeline).to_list(1)
        overall_score = avg_result[0]["average_score"] if avg_result else None
        
        progress_data = {
            "user_access_key": user_access_key,
            "course_id": course_id,
            "total_modules": total_modules,
            "completed_modules": completed_count,
            "progress_percentage": progress_percentage,
            "overall_score": overall_score,
            "last_accessed": datetime.now(timezone.utc).isoformat()
        }
        
        if progress_percentage >= 100:
            progress_data["completed_at"] = datetime.now(timezone.utc).isoformat()
        
        await self.db.course_progress.update_one(
            {"user_access_key": user_access_key, "course_id": course_id},
            {"$set": progress_data, "$setOnInsert": {"started_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
    
    async def get_user_course_progress(self, user_access_key: str, course_id: str) -> Optional[Dict[str, Any]]:
        """Get user's progress for a course"""
        course_progress = await self.db.course_progress.find_one({
            "user_access_key": user_access_key,
            "course_id": course_id
        })
        
        module_progress = await self.db.module_progress.find({
            "user_access_key": user_access_key,
            "course_id": course_id
        }).to_list(length=None)
        
        # Convert ObjectId to string for JSON serialization
        if course_progress and "_id" in course_progress:
            course_progress["_id"] = str(course_progress["_id"])
        
        for progress in module_progress:
            if "_id" in progress:
                progress["_id"] = str(progress["_id"])
        
        return {
            "course_progress": course_progress,
            "module_progress": module_progress
        }
    
    # Quiz Management
    async def submit_quiz(self, user_access_key: str, course_id: str, module_id: str, quiz_id: str, answers: List[Dict]) -> Dict[str, Any]:
        """Submit quiz answers and calculate score"""
        course = await self.get_course(course_id)
        if not course:
            return {"error": "Course not found"}
        
        # Find the module and quiz
        module = None
        quiz = None
        
        for mod in course.modules:
            if mod.id == module_id:
                module = mod
                if mod.content.quiz and mod.content.quiz.id == quiz_id:
                    quiz = mod.content.quiz
                break
        
        if not quiz:
            return {"error": "Quiz not found"}
        
        # Calculate score
        total_points = sum(q.points for q in quiz.questions)
        earned_points = 0
        
        for answer in answers:
            question = next((q for q in quiz.questions if q.id == answer["question_id"]), None)
            if not question:
                continue
            
            # Check answer based on question type
            if question.type in ["multiple_choice", "single_choice"]:
                correct_options = [opt.id for opt in question.options if opt.is_correct]
                selected_options = answer.get("selected_options", [])
                
                if question.type == "single_choice":
                    if len(selected_options) == 1 and selected_options[0] in correct_options:
                        earned_points += question.points
                else:  # multiple_choice
                    if set(selected_options) == set(correct_options):
                        earned_points += question.points
            
            elif question.type == "true_false":
                correct_option = next((opt.id for opt in question.options if opt.is_correct), None)
                selected_options = answer.get("selected_options", [])
                if len(selected_options) == 1 and selected_options[0] == correct_option:
                    earned_points += question.points
            
            elif question.type == "text_input":
                # Simple text comparison (could be enhanced)
                if answer.get("text_answer", "").lower().strip() == question.correct_answer.lower().strip():
                    earned_points += question.points
        
        # Calculate percentage score
        score_percentage = (earned_points / total_points) * 100 if total_points > 0 else 0
        passed = score_percentage >= quiz.passing_score
        
        # Save quiz attempt
        attempt = QuizAttempt(
            user_access_key=user_access_key,
            course_id=course_id,
            module_id=module_id,
            quiz_id=quiz_id,
            answers=[],  # We don't store the actual answers for privacy
            score=score_percentage,
            max_score=total_points,
            passed=passed
        )
        
        attempt_dict = attempt.dict()
        attempt_dict["started_at"] = attempt_dict["started_at"].isoformat()
        attempt_dict["completed_at"] = attempt_dict["completed_at"].isoformat()
        
        await self.db.quiz_attempts.insert_one(attempt_dict)
        
        # Update module progress
        await self.update_module_progress(user_access_key, course_id, module_id, passed, score_percentage)
        
        return {
            "score": score_percentage,
            "max_score": total_points,
            "earned_points": earned_points,
            "passed": passed,
            "passing_score": quiz.passing_score
        }