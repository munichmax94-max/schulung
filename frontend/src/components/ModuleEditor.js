import React, { useState } from 'react';
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Edit, FileText, Video, HelpCircle, File, GripVertical, Presentation } from "lucide-react";
import RichTextEditor from './RichTextEditor';
import QuizEditor from './QuizEditor';
import PresentationManager from './PresentationManager';
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ModuleEditor = ({ courseId, modules = [], onModulesChange }) => {
  const [editingModule, setEditingModule] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const adminToken = localStorage.getItem('adminToken');

  const moduleTypes = [
    { value: 'text', label: 'Text', icon: FileText, description: 'Rich-Text Inhalte' },
    { value: 'video', label: 'Video', icon: Video, description: 'Video-Inhalte' },
    { value: 'quiz', label: 'Quiz', icon: HelpCircle, description: 'Interaktive Quizzes' },
    { value: 'file', label: 'Dateien', icon: File, description: 'Downloadbare Dateien' }
  ];

  const getModuleIcon = (type) => {
    const moduleType = moduleTypes.find(mt => mt.value === type);
    return moduleType ? moduleType.icon : FileText;
  };

  const handleAddModule = () => {
    setEditingModule({
      title: "",
      description: "",
      type: "text",
      content: {
        text_content: "",
        video_url: "",
        file_urls: [],
        quiz: null
      },
      is_required: true,
      estimated_duration_minutes: ""
    });
    setIsDialogOpen(true);
  };

  const handleEditModule = (module) => {
    setEditingModule({
      ...module,
      estimated_duration_minutes: module.estimated_duration_minutes?.toString() || ""
    });
    setIsDialogOpen(true);
  };

  const handleSaveModule = async () => {
    if (!editingModule.title.trim()) {
      toast.error("Bitte geben Sie einen Modultitel ein");
      return;
    }

    setLoading(true);
    try {
      const moduleData = {
        ...editingModule,
        estimated_duration_minutes: editingModule.estimated_duration_minutes ? 
          parseInt(editingModule.estimated_duration_minutes) : null
      };

      if (editingModule.id) {
        // Update existing module
        await axios.put(`${API}/admin/courses/${courseId}/modules/${editingModule.id}`, moduleData, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        toast.success("Modul erfolgreich aktualisiert!");
      } else {
        // Create new module
        await axios.post(`${API}/admin/courses/${courseId}/modules`, moduleData, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        toast.success("Modul erfolgreich hinzugefügt!");
      }

      setIsDialogOpen(false);
      setEditingModule(null);
      onModulesChange(); // Reload course data
    } catch (error) {
      console.error('Error saving module:', error);
      toast.error("Fehler beim Speichern des Moduls");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteModule = async (moduleId) => {
    if (!window.confirm("Sind Sie sicher, dass Sie dieses Modul löschen möchten?")) {
      return;
    }

    try {
      await axios.delete(`${API}/admin/courses/${courseId}/modules/${moduleId}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      toast.success("Modul erfolgreich gelöscht!");
      onModulesChange(); // Reload course data
    } catch (error) {
      console.error('Error deleting module:', error);
      toast.error("Fehler beim Löschen des Moduls");
    }
  };

  const updateModuleContent = (field, value) => {
    setEditingModule(prev => ({
      ...prev,
      content: {
        ...prev.content,
        [field]: value
      }
    }));
  };

  return (
    <div className="space-y-6">
      {/* Module List */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Kursmodule</CardTitle>
              <CardDescription>
                Verwalten Sie die Module Ihres Kurses
              </CardDescription>
            </div>
            <Button onClick={handleAddModule}>
              <Plus className="w-4 h-4 mr-2" />
              Modul hinzufügen
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {modules.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>Noch keine Module erstellt</p>
              <p className="text-sm">Fügen Sie Ihr erstes Modul hinzu, um zu beginnen.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {modules
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map((module, index) => {
                  const IconComponent = getModuleIcon(module.type);
                  return (
                    <div
                      key={module.id}
                      className="flex items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center mr-4 text-gray-400">
                        <GripVertical className="w-4 h-4 mr-2" />
                        <span className="text-sm font-medium">{index + 1}</span>
                      </div>
                      
                      <div className="flex items-center mr-4">
                        <IconComponent className="w-5 h-5 text-emerald-600" />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{module.title}</h4>
                          <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                            {moduleTypes.find(mt => mt.value === module.type)?.label}
                          </span>
                          {module.is_required && (
                            <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded">
                              Erforderlich
                            </span>
                          )}
                        </div>
                        {module.description && (
                          <p className="text-sm text-gray-600 mt-1">{module.description}</p>
                        )}
                        {module.estimated_duration_minutes && (
                          <p className="text-xs text-gray-500 mt-1">
                            Geschätzte Dauer: {module.estimated_duration_minutes} Min.
                          </p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditModule(module)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteModule(module.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Module Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingModule?.id ? 'Modul bearbeiten' : 'Neues Modul'}
            </DialogTitle>
          </DialogHeader>

          {editingModule && (
            <div className="space-y-6 py-4">
              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="module-title">Titel *</Label>
                  <Input
                    id="module-title"
                    value={editingModule.title}
                    onChange={(e) => setEditingModule({...editingModule, title: e.target.value})}
                    placeholder="Modultitel eingeben"
                  />
                </div>

                <div>
                  <Label htmlFor="module-description">Beschreibung</Label>
                  <Textarea
                    id="module-description"
                    value={editingModule.description}
                    onChange={(e) => setEditingModule({...editingModule, description: e.target.value})}
                    placeholder="Kurze Beschreibung des Moduls"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="module-type">Modultyp</Label>
                    <Select
                      value={editingModule.type}
                      onValueChange={(value) => setEditingModule({...editingModule, type: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {moduleTypes.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <type.icon className="w-4 h-4" />
                              <div>
                                <div>{type.label}</div>
                                <div className="text-xs text-gray-500">{type.description}</div>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="module-duration">Geschätzte Dauer (Min.)</Label>
                    <Input
                      id="module-duration"
                      type="number"
                      value={editingModule.estimated_duration_minutes}
                      onChange={(e) => setEditingModule({...editingModule, estimated_duration_minutes: e.target.value})}
                      placeholder="z.B. 30"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="module-required"
                    checked={editingModule.is_required}
                    onChange={(e) => setEditingModule({...editingModule, is_required: e.target.checked})}
                  />
                  <Label htmlFor="module-required">Erforderliches Modul</Label>
                </div>
              </div>

              {/* Content based on type */}
              <div className="border-t pt-6">
                <h4 className="font-medium mb-4">Modulinhalt</h4>
                
                {editingModule.type === 'text' && (
                  <div>
                    <Label>Text-Inhalt</Label>
                    <RichTextEditor
                      value={editingModule.content.text_content || ""}
                      onChange={(content) => updateModuleContent('text_content', content)}
                      placeholder="Geben Sie den Text-Inhalt des Moduls ein..."
                    />
                  </div>
                )}

                {editingModule.type === 'video' && (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="video-url">Video-URL</Label>
                      <Input
                        id="video-url"
                        value={editingModule.content.video_url || ""}
                        onChange={(e) => updateModuleContent('video_url', e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=..."
                      />
                    </div>
                    <div>
                      <Label>Zusätzlicher Text</Label>
                      <RichTextEditor
                        value={editingModule.content.text_content || ""}
                        onChange={(content) => updateModuleContent('text_content', content)}
                        placeholder="Optionaler Text zum Video..."
                        height="200px"
                      />
                    </div>
                  </div>
                )}

                {editingModule.type === 'quiz' && (
                  <QuizEditor
                    quiz={editingModule.content.quiz}
                    onChange={(quiz) => updateModuleContent('quiz', quiz)}
                  />
                )}

                {editingModule.type === 'file' && (
                  <div className="space-y-4">
                    <div>
                      <Label>Datei-URLs (eine pro Zeile)</Label>
                      <Textarea
                        value={(editingModule.content.file_urls || []).join('\n')}
                        onChange={(e) => updateModuleContent('file_urls', e.target.value.split('\n').filter(url => url.trim()))}
                        placeholder="https://example.com/file1.pdf&#10;https://example.com/file2.docx"
                        rows={4}
                      />
                    </div>
                    <div>
                      <Label>Zusätzlicher Text</Label>
                      <RichTextEditor
                        value={editingModule.content.text_content || ""}
                        onChange={(content) => updateModuleContent('text_content', content)}
                        placeholder="Beschreibung der Dateien..."
                        height="200px"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-6 border-t">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Abbrechen
                </Button>
                <Button onClick={handleSaveModule} disabled={loading}>
                  {loading ? 'Speichern...' : 'Speichern'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ModuleEditor;