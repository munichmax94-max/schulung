import React, { useState, useEffect } from 'react';
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { toast } from "sonner";
import { 
  Plus, 
  Trash2, 
  MoveUp, 
  MoveDown, 
  Eye, 
  Save,
  Presentation,
  Type,
  Image,
  List,
  Code,
  Quote,
  Video,
  FileText,
  Layout
} from "lucide-react";

const SlideEditor = ({ initialSlides = [], onSave, onPreview }) => {
  const [slides, setSlides] = useState(initialSlides);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  // Default slide template
  const createEmptySlide = () => ({
    id: Date.now().toString(),
    title: 'Neue Folie',
    layout: 'title-content',
    content: {
      title: '',
      subtitle: '',
      body: '',
      image: '',
      video: '',
      code: '',
      list: [],
      background: '#ffffff',
      textColor: '#333333'
    },
    transition: 'slide',
    notes: ''
  });

  // Initialize with one slide if empty
  useEffect(() => {
    if (slides.length === 0) {
      setSlides([createEmptySlide()]);
    }
  }, []);

  const currentSlide = slides[currentSlideIndex] || createEmptySlide();

  const addSlide = () => {
    const newSlide = createEmptySlide();
    const newSlides = [...slides];
    newSlides.splice(currentSlideIndex + 1, 0, newSlide);
    setSlides(newSlides);
    setCurrentSlideIndex(currentSlideIndex + 1);
    toast.success("Neue Folie hinzugefügt");
  };

  const deleteSlide = (index) => {
    if (slides.length === 1) {
      toast.error("Mindestens eine Folie ist erforderlich");
      return;
    }
    
    const newSlides = slides.filter((_, i) => i !== index);
    setSlides(newSlides);
    
    if (currentSlideIndex >= newSlides.length) {
      setCurrentSlideIndex(newSlides.length - 1);
    }
    toast.success("Folie gelöscht");
  };

  const moveSlide = (index, direction) => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === slides.length - 1)
    ) {
      return;
    }

    const newSlides = [...slides];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    [newSlides[index], newSlides[targetIndex]] = [newSlides[targetIndex], newSlides[index]];
    
    setSlides(newSlides);
    setCurrentSlideIndex(targetIndex);
    toast.success("Folie verschoben");
  };

  const updateCurrentSlide = (updates) => {
    const newSlides = [...slides];
    newSlides[currentSlideIndex] = { ...currentSlide, ...updates };
    setSlides(newSlides);
  };

  const updateSlideContent = (field, value) => {
    updateCurrentSlide({
      content: { ...currentSlide.content, [field]: value }
    });
  };

  const addListItem = () => {
    const newList = [...(currentSlide.content.list || []), ''];
    updateSlideContent('list', newList);
  };

  const updateListItem = (index, value) => {
    const newList = [...(currentSlide.content.list || [])];
    newList[index] = value;
    updateSlideContent('list', newList);
  };

  const removeListItem = (index) => {
    const newList = (currentSlide.content.list || []).filter((_, i) => i !== index);
    updateSlideContent('list', newList);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(slides);
      toast.success("Präsentation gespeichert!");
    } catch (error) {
      toast.error("Fehler beim Speichern");
      console.error('Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = () => {
    onPreview(slides);
  };

  const layoutOptions = [
    { value: 'title-content', label: 'Titel & Inhalt', icon: Layout },
    { value: 'title-only', label: 'Nur Titel', icon: Type },
    { value: 'content-only', label: 'Nur Inhalt', icon: FileText },
    { value: 'two-columns', label: 'Zwei Spalten', icon: Layout },
    { value: 'image-content', label: 'Bild & Text', icon: Image },
    { value: 'list', label: 'Liste', icon: List },
    { value: 'code', label: 'Code', icon: Code },
    { value: 'quote', label: 'Zitat', icon: Quote }
  ];

  const transitionOptions = [
    { value: 'slide', label: 'Slide' },
    { value: 'fade', label: 'Fade' },
    { value: 'convex', label: 'Convex' },
    { value: 'concave', label: 'Concave' },
    { value: 'zoom', label: 'Zoom' }
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Slide Navigator */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Presentation className="w-5 h-5 text-blue-600" />
            Folien ({slides.length})
          </h2>
          <Button onClick={addSlide} className="w-full mt-2" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Folie hinzufügen
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          {slides.map((slide, index) => (
            <div
              key={slide.id}
              className={`mb-2 p-3 rounded-lg border cursor-pointer transition-all ${
                index === currentSlideIndex
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
              onClick={() => setCurrentSlideIndex(index)}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Folie {index + 1}</span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveSlide(index, 'up');
                    }}
                    disabled={index === 0}
                    className="p-1 h-6 w-6"
                  >
                    <MoveUp className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveSlide(index, 'down');
                    }}
                    disabled={index === slides.length - 1}
                    className="p-1 h-6 w-6"
                  >
                    <MoveDown className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSlide(index);
                    }}
                    className="p-1 h-6 w-6 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              
              <div className="text-xs text-gray-600 mb-2">
                {slide.content?.title || 'Ohne Titel'}
              </div>
              
              {/* Mini preview */}
              <div className="bg-gray-50 rounded p-2 text-xs">
                <div className="font-medium">{slide.layout}</div>
                <div className="text-gray-500 truncate">
                  {slide.content?.body?.substring(0, 50)}...
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Editor Panel */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold">
                Folie {currentSlideIndex + 1} bearbeiten
              </h1>
              <Badge variant="outline">{currentSlide.layout}</Badge>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={handlePreview}>
                <Eye className="w-4 h-4 mr-2" />
                Vorschau
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Speichern...' : 'Speichern'}
              </Button>
            </div>
          </div>
        </div>

        {/* Content Editor */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            
            {/* Basic Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Folie Einstellungen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="slide-title">Folie Titel</Label>
                    <Input
                      id="slide-title"
                      value={currentSlide.title}
                      onChange={(e) => updateCurrentSlide({ title: e.target.value })}
                      placeholder="Folie Titel..."
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="slide-layout">Layout</Label>
                    <Select
                      value={currentSlide.layout}
                      onValueChange={(value) => updateCurrentSlide({ layout: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {layoutOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center gap-2">
                              <option.icon className="w-4 h-4" />
                              {option.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="transition">Übergang</Label>
                    <Select
                      value={currentSlide.transition}
                      onValueChange={(value) => updateCurrentSlide({ transition: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {transitionOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="background">Hintergrund</Label>
                    <Input
                      id="background"
                      type="color"
                      value={currentSlide.content.background}
                      onChange={(e) => updateSlideContent('background', e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="textColor">Textfarbe</Label>
                    <Input
                      id="textColor"
                      type="color"
                      value={currentSlide.content.textColor}
                      onChange={(e) => updateSlideContent('textColor', e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Content Editor */}
            <Card>
              <CardHeader>
                <CardTitle>Inhalt</CardTitle>
                <CardDescription>
                  Bearbeiten Sie den Inhalt basierend auf dem gewählten Layout
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                
                {/* Title Field (for most layouts) */}
                {['title-content', 'title-only', 'two-columns', 'image-content'].includes(currentSlide.layout) && (
                  <div>
                    <Label htmlFor="content-title">Haupttitel</Label>
                    <Input
                      id="content-title"
                      value={currentSlide.content.title}
                      onChange={(e) => updateSlideContent('title', e.target.value)}
                      placeholder="Haupttitel eingeben..."
                    />
                  </div>
                )}

                {/* Subtitle Field */}
                {['title-content', 'title-only'].includes(currentSlide.layout) && (
                  <div>
                    <Label htmlFor="content-subtitle">Untertitel</Label>
                    <Input
                      id="content-subtitle"
                      value={currentSlide.content.subtitle}
                      onChange={(e) => updateSlideContent('subtitle', e.target.value)}
                      placeholder="Untertitel eingeben..."
                    />
                  </div>
                )}

                {/* Body Text (for most layouts) */}
                {['title-content', 'content-only', 'two-columns', 'image-content'].includes(currentSlide.layout) && (
                  <div>
                    <Label htmlFor="content-body">Hauptinhalt</Label>
                    <Textarea
                      id="content-body"
                      rows={8}
                      value={currentSlide.content.body}
                      onChange={(e) => updateSlideContent('body', e.target.value)}
                      placeholder="Hauptinhalt eingeben... (Markdown unterstützt)"
                    />
                  </div>
                )}

                {/* List Items */}
                {currentSlide.layout === 'list' && (
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <Label>Listenpunkte</Label>
                      <Button variant="outline" size="sm" onClick={addListItem}>
                        <Plus className="w-4 h-4 mr-2" />
                        Element hinzufügen
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {(currentSlide.content.list || []).map((item, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            value={item}
                            onChange={(e) => updateListItem(index, e.target.value)}
                            placeholder={`Punkt ${index + 1}...`}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeListItem(index)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      {(currentSlide.content.list || []).length === 0 && (
                        <p className="text-gray-500 text-sm">
                          Keine Listenpunkte vorhanden. Klicken Sie "Element hinzufügen".
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Code Block */}
                {currentSlide.layout === 'code' && (
                  <div>
                    <Label htmlFor="content-code">Code</Label>
                    <Textarea
                      id="content-code"
                      rows={10}
                      value={currentSlide.content.code}
                      onChange={(e) => updateSlideContent('code', e.target.value)}
                      placeholder="Code eingeben..."
                      className="font-mono"
                    />
                  </div>
                )}

                {/* Quote */}
                {currentSlide.layout === 'quote' && (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="quote-text">Zitat</Label>
                      <Textarea
                        id="quote-text"
                        rows={4}
                        value={currentSlide.content.body}
                        onChange={(e) => updateSlideContent('body', e.target.value)}
                        placeholder="Zitat eingeben..."
                      />
                    </div>
                    <div>
                      <Label htmlFor="quote-author">Autor</Label>
                      <Input
                        id="quote-author"
                        value={currentSlide.content.title}
                        onChange={(e) => updateSlideContent('title', e.target.value)}
                        placeholder="Autor des Zitats..."
                      />
                    </div>
                  </div>
                )}

                <Separator />

                {/* Media Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="content-image">Bild URL</Label>
                    <Input
                      id="content-image"
                      value={currentSlide.content.image}
                      onChange={(e) => updateSlideContent('image', e.target.value)}
                      placeholder="https://beispiel.com/bild.jpg"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="content-video">Video URL</Label>
                    <Input
                      id="content-video"
                      value={currentSlide.content.video}
                      onChange={(e) => updateSlideContent('video', e.target.value)}
                      placeholder="https://youtube.com/watch?v=..."
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Speaker Notes */}
            <Card>
              <CardHeader>
                <CardTitle>Notizen</CardTitle>
                <CardDescription>
                  Persönliche Notizen für diese Folie (nicht für Lernende sichtbar)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  rows={4}
                  value={currentSlide.notes}
                  onChange={(e) => updateCurrentSlide({ notes: e.target.value })}
                  placeholder="Notizen für diese Folie..."
                />
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </div>
  );
};

export default SlideEditor;