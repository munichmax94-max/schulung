import React, { useState, useEffect } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import axios from "axios";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Badge } from "./components/ui/badge";
import { Separator } from "./components/ui/separator";
import { Alert, AlertDescription } from "./components/ui/alert";
import { Textarea } from "./components/ui/textarea";
import { Label } from "./components/ui/label";
import { toast } from "sonner";
import { BookOpen, Key, User, Lock, Settings, LogOut, CheckCircle, Mail, Plus, Send, Users, Edit, Trash2, Eye, FileText } from "lucide-react";
import CourseEditor from "./components/CourseEditor";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = React.createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing tokens
    const userToken = localStorage.getItem('userToken');
    const adminToken = localStorage.getItem('adminToken');
    
    if (userToken) {
      setUser({ token: userToken });
    }
    
    if (adminToken) {
      const adminData = localStorage.getItem('adminData');
      setAdmin({ 
        token: adminToken, 
        ...JSON.parse(adminData || '{}') 
      });
    }
    
    setLoading(false);
  }, []);

  const loginUser = (token) => {
    localStorage.setItem('userToken', token);
    setUser({ token });
  };

  const loginAdmin = (token, adminData) => {
    localStorage.setItem('adminToken', token);
    localStorage.setItem('adminData', JSON.stringify(adminData));
    setAdmin({ token, ...adminData });
  };

  const logoutUser = () => {
    localStorage.removeItem('userToken');
    setUser(null);
  };

  const logoutAdmin = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminData');
    setAdmin(null);
  };

  return (
    <AuthContext.Provider value={{
      user, admin, loading, 
      loginUser, loginAdmin, 
      logoutUser, logoutAdmin
    }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Components
const LandingPage = () => {
  const [accessKey, setAccessKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { loginUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!accessKey.trim()) {
      setError("Bitte geben Sie einen Access-Key ein");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await axios.post(`${API}/validate-key`, {
        access_key: accessKey.trim()
      });

      if (response.data.success) {
        loginUser(response.data.token);
        toast.success("Access-Key erfolgreich validiert!");
        navigate('/kurse');
      } else {
        setError(response.data.message);
      }
    } catch (err) {
      setError("Fehler bei der Validierung des Access-Keys");
      console.error('Validation error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl mb-6 shadow-lg">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Schulungsportal</h1>
          <p className="text-gray-600">Geben Sie Ihren Access-Key ein, um auf die Schulungen zuzugreifen</p>
        </div>

        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-6">
            <CardTitle className="flex items-center justify-center gap-2 text-xl">
              <Key className="w-5 h-5 text-emerald-600" />
              Access-Key Eingabe
            </CardTitle>
            <CardDescription>
              Verwenden Sie den Ihnen zugesendeten Access-Key
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="text"
                  placeholder="Ihren Access-Key eingeben..."
                  value={accessKey}
                  onChange={(e) => setAccessKey(e.target.value)}
                  className="text-center font-mono tracking-wider h-12"
                  disabled={loading}
                />
              </div>

              {error && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertDescription className="text-red-800">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              <Button 
                type="submit" 
                className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold shadow-lg transition-all duration-200"
                disabled={loading}
              >
                {loading ? "Validierung läuft..." : "Zugriff freischalten"}
              </Button>
            </form>

            <Separator className="my-6" />

            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">
                Sind Sie Administrator?
              </p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/admin')}
                className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
              >
                <Settings className="w-4 h-4 mr-2" />
                Admin-Bereich
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const CourseList = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const response = await axios.get(`${API}/courses`, {
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });
      setCourses(response.data);
    } catch (error) {
      console.error('Error fetching courses:', error);
      if (error.response?.status === 401) {
        logoutUser();
        navigate('/');
      }
      toast.error("Fehler beim Laden der Kurse");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logoutUser();
    navigate('/');
    toast.success("Erfolgreich abgemeldet");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Kurse werden geladen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">Schulungsportal</h1>
            </div>
            <Button 
              variant="outline" 
              onClick={handleLogout}
              className="text-gray-600 hover:text-gray-900"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Abmelden
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Verfügbare Schulungen</h2>
          <p className="text-gray-600">Wählen Sie eine Schulung aus, um zu beginnen</p>
        </div>

        {courses.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Keine Kurse verfügbar
              </h3>
              <p className="text-gray-600">
                Derzeit sind keine Kurse für Ihren Access-Key freigeschaltet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <Card 
                key={course.id} 
                className="hover:shadow-lg transition-all duration-200 cursor-pointer bg-white/80 backdrop-blur-sm"
                onClick={() => navigate(`/kurse/${course.id}`)}
              >
                <CardHeader>
                  <CardTitle className="text-lg line-clamp-2">
                    {course.title}
                  </CardTitle>
                  <CardDescription className="line-clamp-3">
                    {course.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Verfügbar
                    </Badge>
                    <Button variant="outline" size="sm">
                      Öffnen
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

const CourseDetail = () => {
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();
  const courseId = window.location.pathname.split('/').pop();

  useEffect(() => {
    fetchCourse();
  }, [courseId]);

  const fetchCourse = async () => {
    try {
      const response = await axios.get(`${API}/courses/${courseId}`, {
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });
      setCourse(response.data);
    } catch (error) {
      console.error('Error fetching course:', error);
      if (error.response?.status === 404) {
        toast.error("Kurs nicht gefunden");
        navigate('/kurse');
      } else if (error.response?.status === 401) {
        toast.error("Sitzung abgelaufen");
        navigate('/');
      } else {
        toast.error("Fehler beim Laden des Kurses");
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Kurs wird geladen...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center">
        <Card className="text-center p-8">
          <CardContent>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Kurs nicht gefunden</h2>
            <Button onClick={() => navigate('/kurse')}>
              Zurück zur Übersicht
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/kurse')}
              className="mr-4"
            >
              ← Zurück
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">{course.title}</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-2xl">{course.title}</CardTitle>
            <CardDescription className="text-lg">
              {course.description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="prose prose-emerald max-w-none">
              {course.content ? (
                <div dangerouslySetInnerHTML={{ __html: course.content.replace(/\n/g, '<br>') }} />
              ) : (
                <p className="text-gray-600 italic">
                  Kursinhalt wird derzeit vorbereitet...
                </p>
              )}
            </div>

            {course.modules && course.modules.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-4">Kursmodule</h3>
                <div className="space-y-2">
                  {course.modules.map((module, index) => (
                    <Card key={index} className="p-4">
                      <h4 className="font-medium">{module.title}</h4>
                      <p className="text-sm text-gray-600">{module.description}</p>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { loginAdmin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await axios.post(`${API}/admin/login`, {
        email,
        password
      });

      loginAdmin(response.data.access_token, response.data.admin);
      toast.success("Erfolgreich angemeldet!");
      navigate('/admin/dashboard');
    } catch (err) {
      setError("Ungültige E-Mail oder Passwort");
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-slate-600 to-gray-700 rounded-2xl mb-6 shadow-lg">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Administrator</h1>
          <p className="text-gray-600">Melden Sie sich mit Ihren Admin-Zugangsdaten an</p>
        </div>

        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-6">
            <CardTitle className="flex items-center justify-center gap-2 text-xl">
              <User className="w-5 h-5 text-slate-600" />
              Admin Login
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="email"
                  placeholder="E-Mail-Adresse"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Passwort"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              {error && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertDescription className="text-red-800">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              <Button 
                type="submit" 
                className="w-full h-12 bg-gradient-to-r from-slate-600 to-gray-700 hover:from-slate-700 hover:to-gray-800 text-white font-semibold shadow-lg transition-all duration-200"
                disabled={loading}
              >
                {loading ? "Anmeldung läuft..." : "Anmelden"}
              </Button>
            </form>

            <Separator className="my-6" />

            <div className="text-center">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/')}
                className="text-gray-600 border-gray-200 hover:bg-gray-50"
              >
                Zurück zur Startseite
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  const { admin, logoutAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const navigate = useNavigate();

  const handleLogout = () => {
    logoutAdmin();
    navigate('/');
    toast.success("Erfolgreich abgemeldet");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50">
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-slate-600 to-gray-700 rounded-lg flex items-center justify-center">
                <Settings className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">Willkommen, {admin.name}</span>
              <Button 
                variant="outline" 
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Abmelden
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex space-x-8 pt-4 border-b border-gray-200">
          {[
            { id: "overview", label: "Übersicht", icon: Settings },
            { id: "courses", label: "Kurse", icon: BookOpen },
            { id: "keys", label: "Access-Keys", icon: Key },
            { id: "email", label: "E-Mail Versendung", icon: Mail },
            { id: "users", label: "Benutzer", icon: Users }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? "border-slate-600 text-slate-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "courses" && <CoursesTab />}
        {activeTab === "keys" && <AccessKeysTab />}
        {activeTab === "email" && <EmailTab />}
        {activeTab === "users" && <UsersTab />}
      </main>
    </div>
  );
};

// Overview Tab Component
const OverviewTab = () => {
  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Dashboard Übersicht</h2>
        <p className="text-gray-600">Verwalten Sie Ihre Schulungen und Access-Keys</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer bg-white/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-600" />
              Kurse verwalten
            </CardTitle>
            <CardDescription>
              Erstellen und bearbeiten Sie Schulungsinhalte
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer bg-white/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-blue-600" />
              Access-Keys
            </CardTitle>
            <CardDescription>
              Generieren und verwalten Sie Access-Keys
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer bg-white/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-green-600" />
              E-Mail Versendung
            </CardTitle>
            <CardDescription>
              Senden Sie Access-Keys per E-Mail
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
};

// Courses Tab Component
const CoursesTab = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const { admin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      const response = await axios.get(`${API}/admin/courses`, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setCourses(response.data);
    } catch (error) {
      console.error('Error loading courses:', error);
      toast.error("Fehler beim Laden der Kurse");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCourse = async (courseId) => {
    if (!window.confirm("Sind Sie sicher, dass Sie diesen Kurs löschen möchten?")) {
      return;
    }

    try {
      await axios.delete(`${API}/admin/courses/${courseId}`, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      toast.success("Kurs erfolgreich gelöscht!");
      loadCourses();
    } catch (error) {
      console.error('Error deleting course:', error);
      toast.error("Fehler beim Löschen des Kurses");
    }
  };

  const handlePublishToggle = async (course) => {
    try {
      if (course.status === 'published') {
        await axios.post(`${API}/admin/courses/${course.id}/unpublish`, {}, {
          headers: { Authorization: `Bearer ${admin.token}` }
        });
        toast.success("Kurs als Entwurf gesetzt!");
      } else {
        await axios.post(`${API}/admin/courses/${course.id}/publish`, {}, {
          headers: { Authorization: `Bearer ${admin.token}` }
        });
        toast.success("Kurs veröffentlicht!");
      }
      loadCourses();
    } catch (error) {
      console.error('Error toggling publish status:', error);
      toast.error("Fehler beim Ändern des Status");
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Kurse werden geladen...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Kursverwaltung</h2>
          <p className="text-gray-600">Erstellen und verwalten Sie Ihre Schulungskurse</p>
        </div>
        <Button onClick={() => navigate('/admin/courses/new/edit')}>
          <Plus className="w-4 h-4 mr-2" />
          Neuer Kurs
        </Button>
      </div>

      {courses.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Keine Kurse vorhanden</h3>
            <p className="text-gray-600 mb-4">
              Erstellen Sie Ihren ersten Kurs, um zu beginnen.
            </p>
            <Button onClick={() => navigate('/admin/courses/new/edit')}>
              <Plus className="w-4 h-4 mr-2" />
              Ersten Kurs erstellen
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {courses.map((course) => (
            <Card key={course.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{course.title}</h3>
                      <Badge variant={course.status === 'published' ? 'default' : 'secondary'}>
                        {course.status === 'published' ? 'Veröffentlicht' : 'Entwurf'}
                      </Badge>
                      {course.modules && course.modules.length > 0 && (
                        <Badge variant="outline">
                          {course.modules.length} Module
                        </Badge>
                      )}
                    </div>
                    
                    <p className="text-gray-600 mb-3 line-clamp-2">{course.description}</p>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      {course.category && (
                        <span>Kategorie: {course.category}</span>
                      )}
                      {course.difficulty_level && (
                        <span>Schwierigkeit: {course.difficulty_level}</span>
                      )}
                      {course.estimated_duration_hours && (
                        <span>Dauer: {course.estimated_duration_hours}h</span>
                      )}
                    </div>
                    
                    {course.tags && course.tags.length > 0 && (
                      <div className="flex gap-2 mt-3">
                        {course.tags.slice(0, 3).map((tag, index) => (
                          <span key={index} className="text-xs px-2 py-1 bg-gray-100 rounded">
                            {tag}
                          </span>
                        ))}
                        {course.tags.length > 3 && (
                          <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                            +{course.tags.length - 3} weitere
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/admin/courses/${course.id}/edit`)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePublishToggle(course)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteCourse(course.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// Access Keys Tab Component  
const AccessKeysTab = () => {
  const [accessKeys, setAccessKeys] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState("overview");
  const { admin } = useAuth();

  useEffect(() => {
    loadAccessKeys();
    loadUsers();
  }, []);

  const loadAccessKeys = async () => {
    try {
      const response = await axios.get(`${API}/admin/access-keys`, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setAccessKeys(response.data);
    } catch (error) {
      console.error('Error loading access keys:', error);
      toast.error("Fehler beim Laden der Access-Keys");
    }
  };

  const loadUsers = async () => {
    try {
      const response = await axios.get(`${API}/admin/users`, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setUsers(response.data);
    } catch (error) {
      console.error('Error loading users:', error);
      // Don't show error toast as users endpoint might not exist yet
    } finally {
      setLoading(false);
    }
  };

  const toggleKeyStatus = async (keyId, currentStatus) => {
    try {
      await axios.patch(`${API}/admin/access-keys/${keyId}`, {
        is_active: !currentStatus
      }, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      
      toast.success(currentStatus ? "Access-Key deaktiviert" : "Access-Key aktiviert");
      loadAccessKeys();
    } catch (error) {
      console.error('Error toggling key status:', error);
      toast.error("Fehler beim Ändern des Key-Status");
    }
  };

  const deleteKey = async (keyId) => {
    if (!window.confirm("Sind Sie sicher, dass Sie diesen Access-Key löschen möchten?")) {
      return;
    }

    try {
      await axios.delete(`${API}/admin/access-keys/${keyId}`, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      
      toast.success("Access-Key erfolgreich gelöscht");
      loadAccessKeys();
    } catch (error) {
      console.error('Error deleting key:', error);
      toast.error("Fehler beim Löschen des Access-Keys");
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("In Zwischenablage kopiert!");
  };

  const getKeyStatus = (key) => {
    if (!key.is_active) return { status: 'Deaktiviert', color: 'bg-red-100 text-red-800' };
    
    if (key.expires_at && new Date(key.expires_at) < new Date()) {
      return { status: 'Abgelaufen', color: 'bg-orange-100 text-orange-800' };
    }
    
    if (key.max_usage && key.usage_count >= key.max_usage) {
      return { status: 'Limit erreicht', color: 'bg-orange-100 text-orange-800' };
    }
    
    return { status: 'Aktiv', color: 'bg-green-100 text-green-800' };
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unbegrenzt';
    return new Date(dateString).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Access-Keys werden geladen...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Access-Key Verwaltung</h2>
          <p className="text-gray-600">Verwalten Sie alle generierten Access-Keys</p>
        </div>
      </div>

      {/* Sub Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: "overview", label: "Übersicht", icon: Key },
            { id: "statistics", label: "Statistiken", icon: Users },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeSubTab === tab.id
                  ? "border-emerald-500 text-emerald-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeSubTab === "overview" && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <Key className="w-8 h-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Gesamt Keys</p>
                    <p className="text-2xl font-bold text-gray-900">{accessKeys.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Aktive Keys</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {accessKeys.filter(key => getKeyStatus(key).status === 'Aktiv').length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <Users className="w-8 h-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Verwendungen</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {accessKeys.reduce((sum, key) => sum + (key.usage_count || 0), 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <Mail className="w-8 h-8 text-emerald-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Heute erstellt</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {accessKeys.filter(key => {
                        const today = new Date().toDateString();
                        const keyDate = new Date(key.created_at).toDateString();
                        return today === keyDate;
                      }).length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Keys List */}
          {accessKeys.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Key className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Keine Access-Keys vorhanden</h3>
                <p className="text-gray-600">
                  Erstellen Sie Access-Keys über die E-Mail-Versendung.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Alle Access-Keys</CardTitle>
                <CardDescription>
                  Übersicht aller generierten Access-Keys mit Status und Nutzungsinformationen
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Access-Key</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Nutzung</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Erstellt</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Gültig bis</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Ersteller</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600">Aktionen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accessKeys.map((key) => {
                        const keyStatus = getKeyStatus(key);
                        return (
                          <tr key={key.id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                                  {key.key.substring(0, 8)}...
                                </code>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(key.key)}
                                  className="p-1"
                                >
                                  📋
                                </Button>
                              </div>
                            </td>
                            
                            <td className="py-3 px-4">
                              <Badge className={keyStatus.color}>
                                {keyStatus.status}
                              </Badge>
                            </td>
                            
                            <td className="py-3 px-4">
                              <span className="text-sm">
                                {key.usage_count || 0}
                                {key.max_usage ? ` / ${key.max_usage}` : ' / ∞'}
                              </span>
                            </td>
                            
                            <td className="py-3 px-4">
                              <span className="text-sm text-gray-600">
                                {formatDate(key.created_at)}
                              </span>
                            </td>
                            
                            <td className="py-3 px-4">
                              <span className="text-sm text-gray-600">
                                {formatDate(key.expires_at)}
                              </span>
                            </td>
                            
                            <td className="py-3 px-4">
                              <span className="text-sm text-gray-600">
                                {key.created_by || 'System'}
                              </span>
                            </td>
                            
                            <td className="py-3 px-4 text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleKeyStatus(key.id, key.is_active)}
                                  className={key.is_active ? "text-orange-600" : "text-green-600"}
                                >
                                  {key.is_active ? '⏸️' : '▶️'}
                                </Button>
                                
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteKey(key.id)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  🗑️
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Statistics Tab */}
      {activeSubTab === "statistics" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Nutzungsstatistiken</CardTitle>
              <CardDescription>
                Detaillierte Statistiken zur Access-Key-Nutzung
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-4">Keys nach Status</h4>
                  <div className="space-y-2">
                    {[
                      { label: 'Aktiv', count: accessKeys.filter(k => getKeyStatus(k).status === 'Aktiv').length, color: 'text-green-600' },
                      { label: 'Deaktiviert', count: accessKeys.filter(k => getKeyStatus(k).status === 'Deaktiviert').length, color: 'text-red-600' },
                      { label: 'Abgelaufen', count: accessKeys.filter(k => getKeyStatus(k).status === 'Abgelaufen').length, color: 'text-orange-600' },
                      { label: 'Limit erreicht', count: accessKeys.filter(k => getKeyStatus(k).status === 'Limit erreicht').length, color: 'text-purple-600' }
                    ].map(stat => (
                      <div key={stat.label} className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">{stat.label}</span>
                        <span className={`font-medium ${stat.color}`}>{stat.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-4">Erstellung nach Zeit</h4>
                  <div className="space-y-2">
                    {[
                      { 
                        label: 'Heute', 
                        count: accessKeys.filter(k => {
                          const today = new Date().toDateString();
                          return new Date(k.created_at).toDateString() === today;
                        }).length 
                      },
                      { 
                        label: 'Diese Woche', 
                        count: accessKeys.filter(k => {
                          const weekAgo = new Date();
                          weekAgo.setDate(weekAgo.getDate() - 7);
                          return new Date(k.created_at) > weekAgo;
                        }).length 
                      },
                      { 
                        label: 'Dieser Monat', 
                        count: accessKeys.filter(k => {
                          const monthAgo = new Date();
                          monthAgo.setMonth(monthAgo.getMonth() - 1);
                          return new Date(k.created_at) > monthAgo;
                        }).length 
                      }
                    ].map(stat => (
                      <div key={stat.label} className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">{stat.label}</span>
                        <span className="font-medium text-emerald-600">{stat.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h4 className="font-medium mb-4">Meist verwendete Keys</h4>
                <div className="space-y-2">
                  {accessKeys
                    .sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0))
                    .slice(0, 5)
                    .map((key, index) => (
                      <div key={key.id} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                          <code className="text-sm bg-white px-2 py-1 rounded">
                            {key.key.substring(0, 12)}...
                          </code>
                        </div>
                        <span className="font-medium text-emerald-600">
                          {key.usage_count || 0} Verwendungen
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

// Email Tab Component
const EmailTab = () => {
  const [emailType, setEmailType] = useState("single");
  const [singleEmail, setSingleEmail] = useState({ email: "", name: "" });
  const [bulkEmails, setBulkEmails] = useState([{ email: "", name: "" }]);
  const [emailSettings, setEmailSettings] = useState({
    expiresDays: "",
    maxUsage: "",
    courseIds: []
  });
  const [loading, setLoading] = useState(false);
  const { admin } = useAuth();

  const handleSingleEmailSend = async () => {
    if (!singleEmail.email) {
      toast.error("Bitte E-Mail-Adresse eingeben");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/admin/send-single-key`, {
        email: singleEmail.email,
        name: singleEmail.name,
        expires_days: emailSettings.expiresDays ? parseInt(emailSettings.expiresDays) : null,
        max_usage: emailSettings.maxUsage ? parseInt(emailSettings.maxUsage) : null,
        course_ids: emailSettings.courseIds
      }, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });

      toast.success(`Access-Key erfolgreich an ${singleEmail.email} versendet!`);
      setSingleEmail({ email: "", name: "" });
    } catch (error) {
      console.error('Error sending single key:', error);
      toast.error(error.response?.data?.detail || "Fehler beim Versenden des Access-Keys");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkEmailSend = async () => {
    const validEmails = bulkEmails.filter(e => e.email);
    if (validEmails.length === 0) {
      toast.error("Bitte mindestens eine gültige E-Mail-Adresse eingeben");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/admin/send-access-keys`, {
        recipients: validEmails,
        expires_days: emailSettings.expiresDays ? parseInt(emailSettings.expiresDays) : null,
        max_usage: emailSettings.maxUsage ? parseInt(emailSettings.maxUsage) : null,
        course_ids: emailSettings.courseIds
      }, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });

      const results = response.data.email_results;
      toast.success(`${results.successful} von ${results.total} E-Mails erfolgreich versendet!`);
      
      if (results.failed > 0) {
        toast.warning(`${results.failed} E-Mails konnten nicht versendet werden`);
      }

      setBulkEmails([{ email: "", name: "" }]);
    } catch (error) {
      console.error('Error sending bulk keys:', error);
      toast.error(error.response?.data?.detail || "Fehler beim Versenden der Access-Keys");
    } finally {
      setLoading(false);
    }
  };

  const addBulkEmail = () => {
    setBulkEmails([...bulkEmails, { email: "", name: "" }]);
  };

  const removeBulkEmail = (index) => {
    setBulkEmails(bulkEmails.filter((_, i) => i !== index));
  };

  const updateBulkEmail = (index, field, value) => {
    const updated = [...bulkEmails];
    updated[index][field] = value;
    setBulkEmails(updated);
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">E-Mail Versendung</h2>
        <p className="text-gray-600">Senden Sie Access-Keys direkt per E-Mail an Teilnehmer</p>
      </div>

      <div className="space-y-6">
        {/* Email Type Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Versendungsart auswählen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button
                variant={emailType === "single" ? "default" : "outline"}
                onClick={() => setEmailType("single")}
              >
                <Mail className="w-4 h-4 mr-2" />
                Einzelne E-Mail
              </Button>
              <Button
                variant={emailType === "bulk" ? "default" : "outline"}
                onClick={() => setEmailType("bulk")}
              >
                <Users className="w-4 h-4 mr-2" />
                Mehrere E-Mails
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Email Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Access-Key Einstellungen</CardTitle>
            <CardDescription>
              Optionale Einstellungen für die zu generierenden Access-Keys
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="expiresDays">Gültigkeitsdauer (Tage)</Label>
                <Input
                  id="expiresDays"
                  type="number"
                  placeholder="z.B. 30"
                  value={emailSettings.expiresDays}
                  onChange={(e) => setEmailSettings({...emailSettings, expiresDays: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="maxUsage">Maximale Nutzungen</Label>
                <Input
                  id="maxUsage"
                  type="number"
                  placeholder="z.B. 1"
                  value={emailSettings.maxUsage}
                  onChange={(e) => setEmailSettings({...emailSettings, maxUsage: e.target.value})}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Single Email Form */}
        {emailType === "single" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Einzelne E-Mail senden
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="singleEmail">E-Mail-Adresse *</Label>
                  <Input
                    id="singleEmail"
                    type="email"
                    placeholder="teilnehmer@beispiel.de"
                    value={singleEmail.email}
                    onChange={(e) => setSingleEmail({...singleEmail, email: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="singleName">Name (optional)</Label>
                  <Input
                    id="singleName"
                    placeholder="Max Mustermann"
                    value={singleEmail.name}
                    onChange={(e) => setSingleEmail({...singleEmail, name: e.target.value})}
                  />
                </div>
              </div>
              <Button 
                onClick={handleSingleEmailSend}
                disabled={loading || !singleEmail.email}
                className="w-full"
              >
                <Send className="w-4 h-4 mr-2" />
                {loading ? "Wird versendet..." : "Access-Key per E-Mail senden"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Bulk Email Form */}
        {emailType === "bulk" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Mehrere E-Mails senden
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {bulkEmails.map((email, index) => (
                <div key={index} className="flex gap-2 items-end">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor={`bulkEmail${index}`}>E-Mail-Adresse</Label>
                      <Input
                        id={`bulkEmail${index}`}
                        type="email"
                        placeholder="teilnehmer@beispiel.de"
                        value={email.email}
                        onChange={(e) => updateBulkEmail(index, "email", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`bulkName${index}`}>Name (optional)</Label>
                      <Input
                        id={`bulkName${index}`}
                        placeholder="Max Mustermann"
                        value={email.name}
                        onChange={(e) => updateBulkEmail(index, "name", e.target.value)}
                      />
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeBulkEmail(index)}
                    disabled={bulkEmails.length === 1}
                  >
                    Entfernen
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Button variant="outline" onClick={addBulkEmail}>
                  <Plus className="w-4 h-4 mr-2" />
                  Weitere E-Mail hinzufügen
                </Button>
              </div>
              <Button 
                onClick={handleBulkEmailSend}
                disabled={loading || !bulkEmails.some(e => e.email)}
                className="w-full"
              >
                <Send className="w-4 h-4 mr-2" />
                {loading ? "Wird versendet..." : "Access-Keys per E-Mail senden"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

// Users Tab Component
const UsersTab = () => {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Benutzerverwaltung</h2>
      <Card>
        <CardContent className="p-8 text-center">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Benutzerverwaltung in Entwicklung</h3>
          <p className="text-gray-600">
            Die Benutzerverwaltung wird in der nächsten Version verfügbar sein.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

// Protected Route Components
const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { user, admin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (requireAdmin && !admin) {
    return <Navigate to="/admin" replace />;
  }

  if (!requireAdmin && !user) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function App() {
  return (
    <AuthProvider>
      <div className="App">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/admin" element={<AdminLogin />} />
            <Route 
              path="/kurse" 
              element={
                <ProtectedRoute>
                  <CourseList />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/kurse/:courseId" 
              element={
                <ProtectedRoute>
                  <CourseDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/dashboard" 
              element={
                <ProtectedRoute requireAdmin={true}>
                  <AdminDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/courses/:courseId/edit" 
              element={
                <ProtectedRoute requireAdmin={true}>
                  <CourseEditor />
                </ProtectedRoute>
              } 
            />
          </Routes>
        </BrowserRouter>
      </div>
    </AuthProvider>
  );
}

export default App;