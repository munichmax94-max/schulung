import React, { useState } from 'react';
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { toast } from "sonner";
import SlideEditor from "./SlideEditor";
import SlideViewer from "./SlideViewer";
import { 
  Presentation,
  Edit,
  Eye,
  Trash2,
  Plus,
  Save,
  X,
  Slideshow
} from "lucide-react";

const PresentationManager = ({ presentation, onSave, onClose }) => {
  const [currentView, setCurrentView] = useState('editor'); // 'editor', 'preview', 'settings'
  const [presentationData, setPresentationData] = useState(
    presentation || {
      id: Date.now().toString(),
      title: 'Neue Präsentation',
      description: '',
      slides: [],
      theme: 'white',
      auto_slide_duration: null,
      loop: false,
      controls: true,
      progress: true
    }
  );
  const [saving, setSaving] = useState(false);

  const handleSaveSlides = (slides) => {
    setPresentationData(prev => ({
      ...prev,
      slides: slides
    }));
    toast.success("Folien gespeichert!");
  };

  const handlePreviewSlides = (slides) => {
    setPresentationData(prev => ({
      ...prev,
      slides: slides
    }));
    setCurrentView('preview');
  };

  const handleSavePresentation = async () => {
    setSaving(true);
    try {
      await onSave(presentationData);
      toast.success("Präsentation gespeichert!");
    } catch (error) {
      toast.error("Fehler beim Speichern der Präsentation");
      console.error('Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  const updatePresentationSettings = (field, value) => {
    setPresentationData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const themeOptions = [
    { value: 'white', label: 'Weiß', preview: '#ffffff' },
    { value: 'black', label: 'Schwarz', preview: '#1a1a1a' },
    { value: 'league', label: 'League', preview: '#2b2b2b' },
    { value: 'beige', label: 'Beige', preview: '#f7f3de' },
    { value: 'sky', label: 'Himmel', preview: '#3a87ad' },
    { value: 'night', label: 'Nacht', preview: '#111111' },
    { value: 'serif', label: 'Serif', preview: '#f0f1eb' },
    { value: 'simple', label: 'Einfach', preview: '#ffffff' },
    { value: 'solarized', label: 'Solarized', preview: '#fdf6e3' }
  ];

  if (currentView === 'preview') {
    return (
      <div className="h-screen">
        <SlideViewer
          slides={presentationData.slides}
          onClose={() => setCurrentView('editor')}
          onComplete={() => {
            toast.success("Präsentation durchgesehen!");
            setCurrentView('editor');
          }}
        />
      </div>
    );
  }

  if (currentView === 'editor') {
    return (
      <div className="h-screen flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={onClose}>
                <X className="w-4 h-4 mr-2" />
                Schließen
              </Button>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Presentation className="w-5 h-5 text-blue-600" />
                  {presentationData.title}
                </h1>
                <p className="text-sm text-gray-600">
                  {presentationData.slides.length} Folien
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setCurrentView('settings')}
              >
                <Edit className="w-4 h-4 mr-2" />
                Einstellungen
              </Button>
              <Button
                variant="outline"
                onClick={() => handlePreviewSlides(presentationData.slides)}
              >
                <Eye className="w-4 h-4 mr-2" />
                Vollbild-Vorschau
              </Button>
              <Button onClick={handleSavePresentation} disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Speichern...' : 'Speichern'}
              </Button>
            </div>
          </div>
        </div>

        {/* Slide Editor */}
        <div className="flex-1">
          <SlideEditor
            initialSlides={presentationData.slides}
            onSave={handleSaveSlides}
            onPreview={handlePreviewSlides}
          />
        </div>
      </div>
    );
  }

  if (currentView === 'settings') {
    return (
      <div className="h-screen bg-gray-100 p-6">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Präsentations-Einstellungen</h1>
            <Button variant="ghost" onClick={() => setCurrentView('editor')}>
              <X className="w-4 h-4 mr-2" />
              Zurück zum Editor
            </Button>
          </div>

          {/* Settings Cards */}
          <div className="space-y-6">
            
            {/* Basic Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Allgemeine Einstellungen</CardTitle>
                <CardDescription>
                  Grundlegende Informationen zur Präsentation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="presentation-title">Titel</Label>
                  <Input
                    id="presentation-title"
                    value={presentationData.title}
                    onChange={(e) => updatePresentationSettings('title', e.target.value)}
                    placeholder="Präsentationstitel..."
                  />
                </div>

                <div>
                  <Label htmlFor="presentation-description">Beschreibung</Label>
                  <Input
                    id="presentation-description"
                    value={presentationData.description}
                    onChange={(e) => updatePresentationSettings('description', e.target.value)}
                    placeholder="Kurze Beschreibung der Präsentation..."
                  />
                </div>
              </CardContent>
            </Card>

            {/* Appearance Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Erscheinungsbild</CardTitle>
                <CardDescription>
                  Theme und visuelle Einstellungen
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="theme">Theme</Label>
                  <Select
                    value={presentationData.theme}
                    onValueChange={(value) => updatePresentationSettings('theme', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {themeOptions.map(theme => (
                        <SelectItem key={theme.value} value={theme.value}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-4 h-4 rounded border"
                              style={{ backgroundColor: theme.preview }}
                            />
                            {theme.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="controls"
                      checked={presentationData.controls}
                      onChange={(e) => updatePresentationSettings('controls', e.target.checked)}
                    />
                    <Label htmlFor="controls">Navigation anzeigen</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="progress"
                      checked={presentationData.progress}
                      onChange={(e) => updatePresentationSettings('progress', e.target.checked)}
                    />
                    <Label htmlFor="progress">Fortschritt anzeigen</Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Auto Play Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Automatische Wiedergabe</CardTitle>
                <CardDescription>
                  Einstellungen für automatisches Durchlaufen der Folien
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="auto-slide">Automatischer Folienwechsel (Sekunden)</Label>
                  <Input
                    id="auto-slide"
                    type="number"
                    min="0"
                    value={presentationData.auto_slide_duration || ''}
                    onChange={(e) => updatePresentationSettings('auto_slide_duration', 
                      e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="0 = manuell, 5 = alle 5 Sekunden"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Lassen Sie das Feld leer für manuelle Navigation
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="loop"
                    checked={presentationData.loop}
                    onChange={(e) => updatePresentationSettings('loop', e.target.checked)}
                  />
                  <Label htmlFor="loop">Präsentation wiederholen</Label>
                </div>
              </CardContent>
            </Card>

            {/* Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>Statistiken</CardTitle>
                <CardDescription>
                  Übersicht über die aktuelle Präsentation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {presentationData.slides.length}
                    </div>
                    <div className="text-sm text-gray-600">Folien</div>
                  </div>

                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {presentationData.slides.filter(s => s.content.title || s.content.body).length}
                    </div>
                    <div className="text-sm text-gray-600">Mit Inhalt</div>
                  </div>

                  <div>
                    <div className="text-2xl font-bold text-purple-600">
                      {new Set(presentationData.slides.map(s => s.layout)).size}
                    </div>
                    <div className="text-sm text-gray-600">Layouts</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex justify-between">
              <Button 
                variant="outline" 
                onClick={() => setCurrentView('editor')}
              >
                Zurück zum Editor
              </Button>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  onClick={() => handlePreviewSlides(presentationData.slides)}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Vorschau
                </Button>
                <Button onClick={handleSavePresentation} disabled={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Speichern...' : 'Speichern'}
                </Button>
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default PresentationManager;