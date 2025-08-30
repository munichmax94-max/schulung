import React, { useEffect, useRef, useState } from 'react';
import Reveal from 'reveal.js';
import 'reveal.js/dist/reveal.css';
import 'reveal.js/dist/theme/white.css';
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Progress } from "./ui/progress";
import { 
  ChevronLeft, 
  ChevronRight, 
  Home, 
  Maximize2, 
  Minimize2,
  Play,
  Pause,
  RotateCcw,
  CheckCircle
} from "lucide-react";

const SlideViewer = ({ slides = [], onComplete, onClose, courseId, moduleId }) => {
  const deckRef = useRef(null);
  const revealRef = useRef(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [totalSlides, setTotalSlides] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (slides.length === 0) return;

    // Initialize Reveal.js
    const initReveal = async () => {
      if (revealRef.current) {
        revealRef.current.destroy();
      }

      revealRef.current = new Reveal(deckRef.current, {
        hash: false,
        controls: false,
        progress: false,
        center: true,
        transition: 'slide',
        backgroundTransition: 'fade',
        viewDistance: 3,
        mobileViewDistance: 2,
        autoSlide: isPlaying ? 5000 : 0,
        loop: false,
        keyboard: true,
        touch: true,
        fragments: true,
        embedded: false,
        help: true,
        showNotes: false,
        autoPlayMedia: null,
        preloadIframes: null,
        autoAnimateEasing: 'ease',
        autoAnimateDuration: 1.0,
        autoAnimateUnmatched: true,
        plugins: []
      });

      await revealRef.current.initialize();
      
      // Event listeners
      revealRef.current.on('slidechanged', (event) => {
        setCurrentSlide(event.indexh);
        if (event.indexh === slides.length - 1) {
          // User reached last slide
          setTimeout(() => {
            setCompleted(true);
          }, 1000);
        }
      });

      revealRef.current.on('fragmentshown', () => {
        // Handle fragment animations
      });

      setTotalSlides(slides.length);
    };

    initReveal();

    return () => {
      if (revealRef.current) {
        revealRef.current.destroy();
      }
    };
  }, [slides, isPlaying]);

  const renderSlideContent = (slide) => {
    const { layout, content } = slide;
    
    const slideStyle = {
      backgroundColor: content.background || '#ffffff',
      color: content.textColor || '#333333',
      padding: '2rem'
    };

    switch (layout) {
      case 'title-only':
        return (
          <div style={slideStyle} className="text-center">
            <h1 className="text-6xl font-bold mb-4">{content.title}</h1>
            {content.subtitle && (
              <h2 className="text-3xl text-gray-600">{content.subtitle}</h2>
            )}
          </div>
        );

      case 'title-content':
        return (
          <div style={slideStyle}>
            <h1 className="text-5xl font-bold mb-2">{content.title}</h1>
            {content.subtitle && (
              <h2 className="text-2xl text-gray-600 mb-8">{content.subtitle}</h2>
            )}
            {content.body && (
              <div className="text-xl leading-relaxed">
                {content.body.split('\n').map((line, index) => (
                  <p key={index} className="mb-4">{line}</p>
                ))}
              </div>
            )}
            {content.image && (
              <div className="mt-8">
                <img 
                  src={content.image} 
                  alt="Slide content" 
                  className="max-w-full h-auto mx-auto rounded-lg shadow-lg"
                  style={{ maxHeight: '400px' }}
                />
              </div>
            )}
          </div>
        );

      case 'content-only':
        return (
          <div style={slideStyle}>
            <div className="text-2xl leading-relaxed">
              {content.body.split('\n').map((line, index) => (
                <p key={index} className="mb-6">{line}</p>
              ))}
            </div>
            {content.image && (
              <div className="mt-8">
                <img 
                  src={content.image} 
                  alt="Slide content" 
                  className="max-w-full h-auto mx-auto rounded-lg shadow-lg"
                />
              </div>
            )}
          </div>
        );

      case 'two-columns':
        return (
          <div style={slideStyle}>
            <h1 className="text-4xl font-bold mb-8 text-center">{content.title}</h1>
            <div className="grid grid-cols-2 gap-8">
              <div className="text-xl leading-relaxed">
                {content.body.split('\n').map((line, index) => (
                  <p key={index} className="mb-4">{line}</p>
                ))}
              </div>
              <div>
                {content.image && (
                  <img 
                    src={content.image} 
                    alt="Slide content" 
                    className="w-full h-auto rounded-lg shadow-lg"
                  />
                )}
              </div>
            </div>
          </div>
        );

      case 'image-content':
        return (
          <div style={slideStyle}>
            {content.title && (
              <h1 className="text-4xl font-bold mb-6 text-center">{content.title}</h1>
            )}
            <div className="flex items-center justify-center gap-8">
              {content.image && (
                <div className="flex-1">
                  <img 
                    src={content.image} 
                    alt="Slide content" 
                    className="w-full h-auto rounded-lg shadow-lg"
                    style={{ maxHeight: '500px' }}
                  />
                </div>
              )}
              <div className="flex-1 text-xl leading-relaxed">
                {content.body.split('\n').map((line, index) => (
                  <p key={index} className="mb-4">{line}</p>
                ))}
              </div>
            </div>
          </div>
        );

      case 'list':
        return (
          <div style={slideStyle}>
            {content.title && (
              <h1 className="text-5xl font-bold mb-8 text-center">{content.title}</h1>
            )}
            <ul className="text-2xl leading-relaxed space-y-4">
              {(content.list || []).map((item, index) => (
                <li key={index} className="flex items-center">
                  <span className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center mr-4 text-lg font-bold">
                    {index + 1}
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        );

      case 'code':
        return (
          <div style={slideStyle}>
            {content.title && (
              <h1 className="text-4xl font-bold mb-6">{content.title}</h1>
            )}
            <pre className="bg-gray-900 text-green-400 p-6 rounded-lg overflow-x-auto">
              <code className="text-lg">{content.code}</code>
            </pre>
          </div>
        );

      case 'quote':
        return (
          <div style={slideStyle} className="text-center flex flex-col justify-center h-full">
            <blockquote className="text-4xl font-light italic mb-8 leading-relaxed">
              "{content.body}"
            </blockquote>
            {content.title && (
              <cite className="text-2xl text-gray-600">— {content.title}</cite>
            )}
          </div>
        );

      default:
        return (
          <div style={slideStyle}>
            <h1 className="text-4xl font-bold mb-4">{content.title}</h1>
            <p className="text-xl">{content.body}</p>
          </div>
        );
    }
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      if (deckRef.current.requestFullscreen) {
        deckRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  };

  const toggleAutoPlay = () => {
    setIsPlaying(!isPlaying);
    if (revealRef.current) {
      revealRef.current.configure({ autoSlide: !isPlaying ? 5000 : 0 });
    }
  };

  const goToSlide = (index) => {
    if (revealRef.current) {
      revealRef.current.slide(index);
    }
  };

  const nextSlide = () => {
    if (revealRef.current) {
      revealRef.current.next();
    }
  };

  const prevSlide = () => {
    if (revealRef.current) {
      revealRef.current.prev();
    }
  };

  const restartPresentation = () => {
    if (revealRef.current) {
      revealRef.current.slide(0);
      setCompleted(false);
    }
  };

  const handleComplete = async () => {
    if (onComplete) {
      try {
        await onComplete({
          moduleId,
          courseId,
          completed: true,
          timeSpent: Date.now(), // Could track actual time
          slidesViewed: currentSlide + 1,
          totalSlides: totalSlides
        });
      } catch (error) {
        console.error('Error completing presentation:', error);
      }
    }
  };

  const progress = totalSlides > 0 ? ((currentSlide + 1) / totalSlides) * 100 : 0;

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Control Bar */}
      <div className="bg-white border-b border-gray-200 p-3 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <Home className="w-4 h-4 mr-2" />
            Zurück zum Kurs
          </Button>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              Folie {currentSlide + 1} von {totalSlides}
            </span>
            <div className="w-32">
              <Progress value={progress} className="h-2" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={restartPresentation}>
            <RotateCcw className="w-4 h-4" />
          </Button>
          
          <Button variant="ghost" size="sm" onClick={prevSlide} disabled={currentSlide === 0}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <Button variant="ghost" size="sm" onClick={nextSlide} disabled={currentSlide === totalSlides - 1}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          
          <Button variant="ghost" size="sm" onClick={toggleAutoPlay}>
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          
          <Button variant="ghost" size="sm" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
          
          {completed && (
            <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
              <CheckCircle className="w-4 h-4 mr-2" />
              Als abgeschlossen markieren
            </Button>
          )}
        </div>
      </div>

      {/* Presentation Area */}
      <div className="flex-1 relative">
        <div 
          ref={deckRef} 
          className="reveal h-full"
          style={{ 
            width: '100%', 
            height: '100%',
            background: '#f8f9fa'
          }}
        >
          <div className="slides">
            {slides.map((slide, index) => (
              <section 
                key={slide.id || index}
                data-transition={slide.transition || 'slide'}
              >
                {renderSlideContent(slide)}
              </section>
            ))}
          </div>
        </div>
      </div>

      {/* Slide Navigator (Bottom) */}
      <div className="bg-gray-800 p-2 flex gap-1 overflow-x-auto">
        {slides.map((slide, index) => (
          <button
            key={slide.id || index}
            onClick={() => goToSlide(index)}
            className={`min-w-16 h-12 rounded text-xs font-medium transition-colors ${
              index === currentSlide
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {index + 1}
          </button>
        ))}
      </div>

      {/* Completion Overlay */}
      {completed && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="max-w-md mx-4">
            <CardContent className="p-8 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Präsentation abgeschlossen!</h2>
              <p className="text-gray-600 mb-6">
                Sie haben alle {totalSlides} Folien durchgesehen.
              </p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={restartPresentation}>
                  Nochmal ansehen
                </Button>
                <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
                  Als abgeschlossen markieren
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default SlideViewer;