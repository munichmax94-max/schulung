import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { toast } from "sonner";
import { Save, Eye, Trash2, Plus, GripVertical, FileText, Video, HelpCircle, File } from "lucide-react";
import RichTextEditor from './RichTextEditor';
import ModuleEditor from './ModuleEditor';
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CourseEditor = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  
  const [courseData, setCourseData] = useState({
    title: "",
    description: "",
    short_description: "",
    content: "",
    tags: [],
    category: "",
    difficulty_level: "",
    estimated_duration_hours: ""
  });

  const adminToken = localStorage.getItem('adminToken');

  useEffect(() => {
    if (courseId && courseId !== 'new') {
      loadCourse();
    }
  }, [courseId]);

  const loadCourse = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/admin/courses/${courseId}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      
      const courseData = response.data;
      setCourse(courseData);
      setCourseData({
        title: courseData.title || "",
        description: courseData.description || "",
        short_description: courseData.short_description || "",
        content: courseData.content || "",
        tags: courseData.tags || [],
        category: courseData.category || "",
        difficulty_level: courseData.difficulty_level || "",
        estimated_duration_hours: courseData.estimated_duration_hours?.toString() || ""
      });
    } catch (error) {
      console.error('Error loading course:', error);
      toast.error("Fehler beim Laden des Kurses");
      navigate('/admin/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...courseData,
        tags: typeof courseData.tags === 'string' ? courseData.tags.split(',').map(tag => tag.trim()) : courseData.tags,
        estimated_duration_hours: courseData.estimated_duration_hours ? parseFloat(courseData.estimated_duration_hours) : null
      };

      let response;
      if (courseId === 'new') {
        response = await axios.post(`${API}/admin/courses`, payload, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        toast.success("Kurs erfolgreich erstellt!");
        navigate(`/admin/courses/${response.data.id}/edit`);
      } else {
        response = await axios.put(`${API}/admin/courses/${courseId}`, payload, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        setCourse(response.data);
        toast.success("Kurs erfolgreich gespeichert!");
      }
    } catch (error) {
      console.error('Error saving course:', error);
      toast.error("Fehler beim Speichern des Kurses");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!course) return;
    
    try {
      await axios.post(`${API}/admin/courses/${courseId}/publish`, {}, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      
      toast.success("Kurs erfolgreich veröffentlicht!");
      loadCourse(); // Reload to get updated status
    } catch (error) {
      console.error('Error publishing course:', error);
      toast.error("Fehler beim Veröffentlichen des Kurses");
    }
  };

  const handleUnpublish = async () => {
    if (!course) return;
    
    try {
      await axios.post(`${API}/admin/courses/${courseId}/unpublish`, {}, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      
      toast.success("Kurs als Entwurf gesetzt!");
      loadCourse(); // Reload to get updated status
    } catch (error) {
      console.error('Error unpublishing course:', error);
      toast.error("Fehler beim Entveröffentlichen des Kurses");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Kurs wird geladen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={() => navigate('/admin/dashboard')}>
                ← Zurück
              </Button>
              <h1 className="text-xl font-bold text-gray-900">
                {courseId === 'new' ? 'Neuer Kurs' : 'Kurs bearbeiten'}
              </h1>
              {course && (
                <Badge variant={course.status === 'published' ? 'default' : 'secondary'}>
                  {course.status === 'published' ? 'Veröffentlicht' : 'Entwurf'}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {course && course.status === 'draft' && (
                <Button onClick={handlePublish} variant="outline">
                  <Eye className="w-4 h-4 mr-2" />
                  Veröffentlichen
                </Button>
              )}
              {course && course.status === 'published' && (
                <Button onClick={handleUnpublish} variant="outline">
                  Entveröffentlichen
                </Button>
              )}
              <Button onClick={handleSave} disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Speichern...' : 'Speichern'}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Kursdetails</TabsTrigger>
            <TabsTrigger value="content">Inhalt</TabsTrigger>
            <TabsTrigger value="modules">Module</TabsTrigger>
          </TabsList>

          {/* Course Details Tab */}
          <TabsContent value="details" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Grundinformationen</CardTitle>
                <CardDescription>
                  Definieren Sie die grundlegenden Informationen für Ihren Kurs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title">Kurstitel *</Label>
                  <Input
                    id="title"
                    value={courseData.title}
                    onChange={(e) => setCourseData({...courseData, title: e.target.value})}
                    placeholder="Geben Sie den Kurstitel ein"
                  />
                </div>

                <div>
                  <Label htmlFor="short_description">Kurzbeschreibung</Label>
                  <Textarea
                    id="short_description"
                    value={courseData.short_description}
                    onChange={(e) => setCourseData({...courseData, short_description: e.target.value})}
                    placeholder="Kurze Beschreibung für die Kursübersicht"
                    rows={2}
                  />
                </div>

                <div>
                  <Label htmlFor="description">Beschreibung *</Label>
                  <Textarea
                    id="description"
                    value={courseData.description}
                    onChange={(e) => setCourseData({...courseData, description: e.target.value})}
                    placeholder="Detaillierte Kursbeschreibung"
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="category">Kategorie</Label>
                    <Input
                      id="category"
                      value={courseData.category}
                      onChange={(e) => setCourseData({...courseData, category: e.target.value})}
                      placeholder="z.B. IT, Marketing"
                    />
                  </div>

                  <div>
                    <Label htmlFor="difficulty">Schwierigkeitsgrad</Label>
                    <Select 
                      value={courseData.difficulty_level} 
                      onValueChange={(value) => setCourseData({...courseData, difficulty_level: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Wählen Sie den Schwierigkeitsgrad" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginner">Anfänger</SelectItem>
                        <SelectItem value="intermediate">Fortgeschritten</SelectItem>
                        <SelectItem value="advanced">Experte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="duration">Geschätzte Dauer (Stunden)</Label>
                    <Input
                      id="duration"
                      type="number"
                      step="0.5"
                      value={courseData.estimated_duration_hours}
                      onChange={(e) => setCourseData({...courseData, estimated_duration_hours: e.target.value})}
                      placeholder="z.B. 2.5"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="tags">Tags (kommagetrennt)</Label>
                  <Input
                    id="tags"
                    value={Array.isArray(courseData.tags) ? courseData.tags.join(', ') : courseData.tags}
                    onChange={(e) => setCourseData({...courseData, tags: e.target.value})}
                    placeholder="z.B. grundlagen, schulung, management"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Content Tab */}
          <TabsContent value="content" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Kursinhalt</CardTitle>
                <CardDescription>
                  Erstellen Sie den Hauptinhalt Ihres Kurses mit dem Rich-Text-Editor
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RichTextEditor
                  value={courseData.content}
                  onChange={(content) => setCourseData({...courseData, content})}
                  placeholder="Geben Sie den Hauptinhalt Ihres Kurses ein..."
                  height="400px"
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Modules Tab */}
          <TabsContent value="modules" className="space-y-6">
            {course && (
              <ModuleEditor courseId={course.id} modules={course.modules || []} onModulesChange={loadCourse} />
            )}
            {!course && courseId === 'new' && (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-gray-600">
                    Speichern Sie zuerst die Grundinformationen des Kurses, um Module hinzufügen zu können.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default CourseEditor;