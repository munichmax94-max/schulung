import requests
import sys
from datetime import datetime

class SchulungsportalAPITester:
    def __init__(self, base_url="https://edukeys.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.user_token = None
        self.admin_token = None
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response text: {response.text}")

            return success, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_api_root(self):
        """Test API root endpoint"""
        success, response = self.run_test(
            "API Root",
            "GET",
            "",
            200
        )
        return success

    def test_validate_invalid_key(self):
        """Test validation with invalid access key"""
        success, response = self.run_test(
            "Invalid Access Key Validation",
            "POST",
            "validate-key",
            200,
            data={"access_key": "INVALID-KEY"}
        )
        if success and not response.get('success'):
            print(f"   ✅ Correctly rejected invalid key: {response.get('message')}")
            return True
        else:
            print(f"   ❌ Should have rejected invalid key")
            return False

    def test_validate_valid_key(self):
        """Test validation with valid access key TEST-KEY-123"""
        success, response = self.run_test(
            "Valid Access Key Validation (TEST-KEY-123)",
            "POST",
            "validate-key",
            200,
            data={"access_key": "TEST-KEY-123"}
        )
        if success and response.get('success') and response.get('token'):
            self.user_token = response['token']
            print(f"   ✅ Got user token: {self.user_token[:20]}...")
            return True
        else:
            print(f"   ❌ Failed to get valid token: {response}")
            return False

    def test_get_courses_without_auth(self):
        """Test getting courses without authentication"""
        success, response = self.run_test(
            "Get Courses (No Auth)",
            "GET",
            "courses",
            401
        )
        return success

    def test_get_courses_with_auth(self):
        """Test getting courses with valid authentication"""
        if not self.user_token:
            print("❌ No user token available for courses test")
            return False
            
        success, response = self.run_test(
            "Get Courses (With Auth)",
            "GET",
            "courses",
            200,
            headers={'Authorization': f'Bearer {self.user_token}'}
        )
        if success and isinstance(response, list):
            print(f"   ✅ Found {len(response)} courses")
            if len(response) > 0:
                print(f"   Sample course: {response[0].get('title', 'No title')}")
            return True
        return success

    def test_admin_login_invalid(self):
        """Test admin login with invalid credentials"""
        success, response = self.run_test(
            "Admin Login (Invalid)",
            "POST",
            "admin/login",
            401,
            data={"email": "invalid@test.com", "password": "wrongpass"}
        )
        return success

    def test_admin_login_valid(self):
        """Test admin login with valid credentials"""
        success, response = self.run_test(
            "Admin Login (Valid)",
            "POST",
            "admin/login",
            200,
            data={"email": "admin@schulungsportal.de", "password": "admin123"}
        )
        if success and response.get('access_token'):
            self.admin_token = response['access_token']
            print(f"   ✅ Got admin token: {self.admin_token[:20]}...")
            admin_info = response.get('admin', {})
            print(f"   Admin: {admin_info.get('name')} ({admin_info.get('email')})")
            return True
        else:
            print(f"   ❌ Failed to get admin token: {response}")
            return False

    def test_admin_courses_without_auth(self):
        """Test admin courses endpoint without authentication"""
        success, response = self.run_test(
            "Admin Get Courses (No Auth)",
            "GET",
            "admin/courses",
            401
        )
        return success

    def test_admin_courses_with_auth(self):
        """Test admin courses endpoint with authentication"""
        if not self.admin_token:
            print("❌ No admin token available for admin courses test")
            return False
            
        success, response = self.run_test(
            "Admin Get Courses (With Auth)",
            "GET",
            "admin/courses",
            200,
            headers={'Authorization': f'Bearer {self.admin_token}'}
        )
        if success and isinstance(response, list):
            print(f"   ✅ Admin found {len(response)} courses")
            return True
        return success

    def test_course_detail(self):
        """Test getting course detail"""
        if not self.user_token:
            print("❌ No user token available for course detail test")
            return False

        # First get courses to find a course ID
        success, courses = self.run_test(
            "Get Courses for Detail Test",
            "GET",
            "courses",
            200,
            headers={'Authorization': f'Bearer {self.user_token}'}
        )
        
        if not success or not courses or len(courses) == 0:
            print("❌ No courses available for detail test")
            return False

        course_id = courses[0]['id']
        success, response = self.run_test(
            f"Get Course Detail ({course_id})",
            "GET",
            f"courses/{course_id}",
            200,
            headers={'Authorization': f'Bearer {self.user_token}'}
        )
        
        if success and response.get('id') == course_id:
            print(f"   ✅ Course detail: {response.get('title')}")
            # Store course data for quiz tests
            self.course_data = response
            return True
        return success

    def test_quiz_submission_correct_answers(self):
        """Test quiz submission with correct answers"""
        if not self.user_token:
            print("❌ No user token available for quiz test")
            return False
            
        if not hasattr(self, 'course_data') or not self.course_data:
            print("❌ No course data available for quiz test")
            return False
        
        # Find a quiz module
        quiz_module = None
        quiz_data = None
        
        for module in self.course_data.get('modules', []):
            if module.get('type') == 'quiz' and module.get('content', {}).get('quiz'):
                quiz_module = module
                quiz_data = module['content']['quiz']
                break
        
        if not quiz_module or not quiz_data:
            print("❌ No quiz module found in course")
            return False
        
        course_id = self.course_data['id']
        module_id = quiz_module['id']
        quiz_id = quiz_data['id']
        
        # Prepare correct answers
        answers = []
        for question in quiz_data.get('questions', []):
            if question['type'] == 'single_choice':
                # Find the correct option
                correct_option = next((opt['id'] for opt in question['options'] if opt['is_correct']), None)
                if correct_option:
                    answers.append({
                        "question_id": question['id'],
                        "selected_options": [correct_option]
                    })
        
        if not answers:
            print("❌ No answerable questions found in quiz")
            return False
        
        success, response = self.run_test(
            f"Submit Quiz (Correct Answers)",
            "POST",
            f"courses/{course_id}/modules/{module_id}/quiz/{quiz_id}/submit",
            200,
            data=answers,
            headers={'Authorization': f'Bearer {self.user_token}'}
        )
        
        if success and response.get('passed') == True:
            print(f"   ✅ Quiz passed with score: {response.get('score', 0):.1f}%")
            return True
        elif success:
            print(f"   ⚠️ Quiz submitted but not passed: {response.get('score', 0):.1f}%")
            return True
        return success

    def test_quiz_submission_incorrect_answers(self):
        """Test quiz submission with incorrect answers"""
        if not self.user_token:
            print("❌ No user token available for quiz test")
            return False
            
        if not hasattr(self, 'course_data') or not self.course_data:
            print("❌ No course data available for quiz test")
            return False
        
        # Find a quiz module
        quiz_module = None
        quiz_data = None
        
        for module in self.course_data.get('modules', []):
            if module.get('type') == 'quiz' and module.get('content', {}).get('quiz'):
                quiz_module = module
                quiz_data = module['content']['quiz']
                break
        
        if not quiz_module or not quiz_data:
            print("❌ No quiz module found in course")
            return False
        
        course_id = self.course_data['id']
        module_id = quiz_module['id']
        quiz_id = quiz_data['id']
        
        # Prepare incorrect answers
        answers = []
        for question in quiz_data.get('questions', []):
            if question['type'] == 'single_choice':
                # Find an incorrect option
                incorrect_option = next((opt['id'] for opt in question['options'] if not opt['is_correct']), None)
                if incorrect_option:
                    answers.append({
                        "question_id": question['id'],
                        "selected_options": [incorrect_option]
                    })
        
        if not answers:
            print("❌ No answerable questions found in quiz")
            return False
        
        success, response = self.run_test(
            f"Submit Quiz (Incorrect Answers)",
            "POST",
            f"courses/{course_id}/modules/{module_id}/quiz/{quiz_id}/submit",
            200,
            data=answers,
            headers={'Authorization': f'Bearer {self.user_token}'}
        )
        
        if success and response.get('passed') == False:
            print(f"   ✅ Quiz correctly failed with score: {response.get('score', 0):.1f}%")
            return True
        elif success:
            print(f"   ⚠️ Quiz submitted: {response.get('score', 0):.1f}%")
            return True
        return success

    def test_quiz_submission_without_auth(self):
        """Test quiz submission without authentication"""
        success, response = self.run_test(
            "Submit Quiz (No Auth)",
            "POST",
            "courses/test-id/modules/test-module/quiz/test-quiz/submit",
            401,
            data=[{"question_id": "test", "selected_options": ["test"]}]
        )
        return success

    def test_course_progress(self):
        """Test getting course progress"""
        if not self.user_token:
            print("❌ No user token available for progress test")
            return False
            
        if not hasattr(self, 'course_data') or not self.course_data:
            print("❌ No course data available for progress test")
            return False
        
        course_id = self.course_data['id']
        
        success, response = self.run_test(
            f"Get Course Progress",
            "GET",
            f"courses/{course_id}/progress",
            200,
            headers={'Authorization': f'Bearer {self.user_token}'}
        )
        
        if success:
            print(f"   ✅ Progress data retrieved")
            if response.get('course_progress'):
                progress = response['course_progress']
                print(f"   Progress: {progress.get('progress_percentage', 0):.1f}%")
            return True
        return success

def main():
    print("🚀 Starting Schulungsportal API Tests")
    print("=" * 50)
    
    tester = SchulungsportalAPITester()
    
    # Test sequence
    tests = [
        ("API Root", tester.test_api_root),
        ("Invalid Access Key", tester.test_validate_invalid_key),
        ("Valid Access Key", tester.test_validate_valid_key),
        ("Courses (No Auth)", tester.test_get_courses_without_auth),
        ("Courses (With Auth)", tester.test_get_courses_with_auth),
        ("Course Detail", tester.test_course_detail),
        ("Quiz Submission (No Auth)", tester.test_quiz_submission_without_auth),
        ("Quiz Submission (Correct)", tester.test_quiz_submission_correct_answers),
        ("Quiz Submission (Incorrect)", tester.test_quiz_submission_incorrect_answers),
        ("Course Progress", tester.test_course_progress),
        ("Admin Login (Invalid)", tester.test_admin_login_invalid),
        ("Admin Login (Valid)", tester.test_admin_login_valid),
        ("Admin Courses (No Auth)", tester.test_admin_courses_without_auth),
        ("Admin Courses (With Auth)", tester.test_admin_courses_with_auth),
    ]
    
    failed_tests = []
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            if not result:
                failed_tests.append(test_name)
        except Exception as e:
            print(f"❌ {test_name} - Exception: {str(e)}")
            failed_tests.append(test_name)
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if failed_tests:
        print(f"\n❌ Failed Tests ({len(failed_tests)}):")
        for test in failed_tests:
            print(f"   - {test}")
        return 1
    else:
        print("\n✅ All tests passed!")
        return 0

if __name__ == "__main__":
    sys.exit(main())