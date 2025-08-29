from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
from enum import Enum

# Enums for course management
class CourseStatus(str, Enum):
    draft = "draft"
    published = "published"
    archived = "archived"

class ModuleType(str, Enum):
    text = "text"
    video = "video"
    quiz = "quiz"
    file = "file"

class QuestionType(str, Enum):
    multiple_choice = "multiple_choice"
    single_choice = "single_choice"
    true_false = "true_false"
    text_input = "text_input"
    essay = "essay"

# Quiz Models
class QuizOption(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str
    is_correct: bool = False

class QuizQuestion(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    question: str
    type: QuestionType
    options: List[QuizOption] = []
    correct_answer: Optional[str] = None  # For text input questions
    points: int = 1
    explanation: Optional[str] = None

class Quiz(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: Optional[str] = ""
    questions: List[QuizQuestion] = []
    passing_score: int = 70  # Percentage
    max_attempts: Optional[int] = None
    time_limit_minutes: Optional[int] = None

# Module Models
class ModuleContent(BaseModel):
    text_content: Optional[str] = ""  # Rich text content
    video_url: Optional[str] = None
    file_urls: List[str] = []
    quiz: Optional[Quiz] = None

class CourseModule(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: Optional[str] = ""
    type: ModuleType
    content: ModuleContent
    order: int = 0
    is_required: bool = True
    estimated_duration_minutes: Optional[int] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Enhanced Course Model
class Course(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    short_description: Optional[str] = ""
    content: str = ""  # Rich text overview content
    status: CourseStatus = CourseStatus.draft
    modules: List[CourseModule] = []
    tags: List[str] = []
    category: Optional[str] = None
    difficulty_level: Optional[str] = None  # beginner, intermediate, advanced
    estimated_duration_hours: Optional[float] = None
    thumbnail_url: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    version: int = 1

# Course Creation/Update Models
class CourseCreate(BaseModel):
    title: str
    description: str
    short_description: Optional[str] = ""
    content: Optional[str] = ""
    tags: List[str] = []
    category: Optional[str] = None
    difficulty_level: Optional[str] = None
    estimated_duration_hours: Optional[float] = None

class CourseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    short_description: Optional[str] = None
    content: Optional[str] = None
    status: Optional[CourseStatus] = None
    tags: Optional[List[str]] = None
    category: Optional[str] = None
    difficulty_level: Optional[str] = None
    estimated_duration_hours: Optional[float] = None

class ModuleCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    type: ModuleType
    content: ModuleContent
    is_required: Optional[bool] = True
    estimated_duration_minutes: Optional[int] = None

class ModuleUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    type: Optional[ModuleType] = None
    content: Optional[ModuleContent] = None
    order: Optional[int] = None
    is_required: Optional[bool] = None
    estimated_duration_minutes: Optional[int] = None

# Progress Tracking Models
class ModuleProgress(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_access_key: str
    course_id: str
    module_id: str
    completed: bool = False
    score: Optional[float] = None  # For quizzes
    time_spent_minutes: Optional[int] = None
    attempts: int = 0
    last_accessed: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None

class CourseProgress(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_access_key: str
    course_id: str
    total_modules: int
    completed_modules: int
    progress_percentage: float = 0.0
    overall_score: Optional[float] = None
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_accessed: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None

# Quiz Results Models
class QuizAnswer(BaseModel):
    question_id: str
    selected_options: List[str] = []  # For multiple choice
    text_answer: Optional[str] = None  # For text input

class QuizAttempt(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_access_key: str
    course_id: str
    module_id: str
    quiz_id: str
    answers: List[QuizAnswer]
    score: float
    max_score: int
    passed: bool
    time_taken_minutes: Optional[int] = None
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Existing Models (keeping for compatibility)
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

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_token: Optional[str] = None
    access_key: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_login: Optional[datetime] = None

class Admin(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    password_hash: str
    name: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Request/Response Models
class EmailRequest(BaseModel):
    email: EmailStr
    name: Optional[str] = ""

class BulkEmailRequest(BaseModel):
    recipients: List[EmailRequest]
    count: Optional[int] = None
    expires_days: Optional[int] = None
    max_usage: Optional[int] = None
    course_ids: List[str] = []

class AccessKeyCreate(BaseModel):
    access_key: str

class AccessKeyValidation(BaseModel):
    success: bool
    message: str
    token: Optional[str] = None

class AdminLogin(BaseModel):
    email: EmailStr
    password: str

class AdminCreate(BaseModel):
    email: EmailStr
    password: str
    name: str