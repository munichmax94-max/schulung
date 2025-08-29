import React, { useState, useEffect } from 'react';
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Textarea } from "./ui/textarea";
import { Progress } from "./ui/progress";
import { toast } from "sonner";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Trophy, 
  RefreshCw, 
  ArrowRight, 
  ArrowLeft,
  HelpCircle,
  Target
} from "lucide-react";

const QuizRunner = ({ quiz, courseId, moduleId, onComplete, onCancel }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [loading, setLoading] = useState(false);

  const currentQuestion = quiz.questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / quiz.questions.length) * 100;

  useEffect(() => {
    setStartTime(new Date());
    
    // Initialize timer if quiz has time limit
    if (quiz.time_limit_minutes) {
      setTimeLeft(quiz.time_limit_minutes * 60); // Convert to seconds
    }
  }, [quiz.time_limit_minutes]);

  useEffect(() => {
    if (timeLeft !== null && timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);
      
      return () => clearTimeout(timer);
    } else if (timeLeft === 0) {
      handleSubmitQuiz();
    }
  }, [timeLeft]);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleAnswerChange = (questionId, answerData) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answerData
    }));
  };

  const handleSingleChoice = (questionId, optionId) => {
    handleAnswerChange(questionId, {
      selected_options: [optionId],
      text_answer: null
    });
  };

  const handleMultipleChoice = (questionId, optionId) => {
    const currentAnswer = answers[questionId] || { selected_options: [], text_answer: null };
    const selectedOptions = currentAnswer.selected_options || [];
    
    const newSelectedOptions = selectedOptions.includes(optionId)
      ? selectedOptions.filter(id => id !== optionId)
      : [...selectedOptions, optionId];
    
    handleAnswerChange(questionId, {
      selected_options: newSelectedOptions,
      text_answer: null
    });
  };

  const handleTextInput = (questionId, text) => {
    handleAnswerChange(questionId, {
      selected_options: [],
      text_answer: text
    });
  };

  const goToNextQuestion = () => {
    if (currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      handleSubmitQuiz();
    }
  };

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmitQuiz = async () => {
    setLoading(true);
    try {
      // Calculate time taken
      const endTime = new Date();
      const timeTakenMinutes = Math.round((endTime - startTime) / (1000 * 60));
      
      // Format answers for API
      const formattedAnswers = quiz.questions.map(question => {
        const answer = answers[question.id] || { selected_options: [], text_answer: null };
        return {
          question_id: question.id,
          selected_options: answer.selected_options || [],
          text_answer: answer.text_answer || null
        };
      });

      // Submit to backend
      const response = await fetch(`/api/courses/${courseId}/modules/${moduleId}/quiz/${quiz.id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('userToken')}`
        },
        body: JSON.stringify(formattedAnswers)
      });

      if (response.ok) {
        const result = await response.json();
        setResult({
          ...result,
          timeTaken: timeTakenMinutes,
          totalQuestions: quiz.questions.length
        });
        setShowResult(true);
        toast.success(result.passed ? "Quiz bestanden! 🎉" : "Quiz nicht bestanden");
      } else {
        throw new Error('Quiz submission failed');
      }
    } catch (error) {
      console.error('Error submitting quiz:', error);
      toast.error("Fehler beim Einreichen des Quiz");
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setCurrentQuestionIndex(0);
    setAnswers({});
    setShowResult(false);
    setResult(null);
    setStartTime(new Date());
    
    if (quiz.time_limit_minutes) {
      setTimeLeft(quiz.time_limit_minutes * 60);
    }
  };

  const isAnswered = (questionId) => {
    const answer = answers[questionId];
    if (!answer) return false;
    
    return (answer.selected_options && answer.selected_options.length > 0) || 
           (answer.text_answer && answer.text_answer.trim().length > 0);
  };

  const getAnsweredCount = () => {
    return quiz.questions.filter(q => isAnswered(q.id)).length;
  };

  // Show result screen
  if (showResult && result) {
    return <QuizResult result={result} quiz={quiz} answers={answers} onRetry={handleRetry} onComplete={onComplete} />;
  }

  if (!currentQuestion) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Quiz nicht verfügbar</h3>
          <p className="text-gray-600">Dieses Quiz enthält keine Fragen.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Quiz Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-emerald-600" />
                {quiz.title}
              </CardTitle>
              <CardDescription>{quiz.description}</CardDescription>
            </div>
            <div className="text-right">
              {timeLeft !== null && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orange-600" />
                  <span className={`font-mono ${timeLeft < 300 ? 'text-red-600' : 'text-gray-600'}`}>
                    {formatTime(timeLeft)}
                  </span>
                </div>
              )}
            </div>
          </div>
          
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Frage {currentQuestionIndex + 1} von {quiz.questions.length}</span>
              <span>{getAnsweredCount()} von {quiz.questions.length} beantwortet</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </CardHeader>
      </Card>

      {/* Question Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline">{getQuestionTypeLabel(currentQuestion.type)}</Badge>
                <Badge variant="secondary">{currentQuestion.points} Punkt{currentQuestion.points !== 1 ? 'e' : ''}</Badge>
              </div>
              <CardTitle className="text-lg leading-relaxed">
                {currentQuestion.question}
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <QuestionRenderer 
            question={currentQuestion}
            answer={answers[currentQuestion.id]}
            onAnswerChange={handleAnswerChange}
            onSingleChoice={handleSingleChoice}
            onMultipleChoice={handleMultipleChoice}
            onTextInput={handleTextInput}
          />
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          onClick={goToPreviousQuestion}
          disabled={currentQuestionIndex === 0}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Zurück
        </Button>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            Abbrechen
          </Button>
          
          {currentQuestionIndex === quiz.questions.length - 1 ? (
            <Button 
              onClick={handleSubmitQuiz} 
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Wird ausgewertet...
                </>
              ) : (
                <>
                  <Target className="w-4 h-4 mr-2" />
                  Quiz abschließen
                </>
              )}
            </Button>
          ) : (
            <Button onClick={goToNextQuestion}>
              Weiter
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

// Question Renderer Component
const QuestionRenderer = ({ question, answer, onAnswerChange, onSingleChoice, onMultipleChoice, onTextInput }) => {
  const currentAnswer = answer || { selected_options: [], text_answer: null };

  switch (question.type) {
    case 'single_choice':
    case 'true_false':
      return (
        <div className="space-y-3">
          {question.options.map((option, index) => (
            <label
              key={option.id}
              className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors hover:bg-gray-50 ${
                currentAnswer.selected_options?.includes(option.id) 
                  ? 'border-emerald-500 bg-emerald-50' 
                  : 'border-gray-200'
              }`}
            >
              <input
                type="radio"
                name={`question-${question.id}`}
                checked={currentAnswer.selected_options?.includes(option.id) || false}
                onChange={() => onSingleChoice(question.id, option.id)}
                className="text-emerald-600"
              />
              <span className="flex-1">{option.text}</span>
            </label>
          ))}
        </div>
      );

    case 'multiple_choice':
      return (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 mb-3">Mehrere Antworten möglich:</p>
          {question.options.map((option, index) => (
            <label
              key={option.id}
              className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors hover:bg-gray-50 ${
                currentAnswer.selected_options?.includes(option.id) 
                  ? 'border-emerald-500 bg-emerald-50' 
                  : 'border-gray-200'
              }`}
            >
              <input
                type="checkbox"
                checked={currentAnswer.selected_options?.includes(option.id) || false}
                onChange={() => onMultipleChoice(question.id, option.id)}
                className="text-emerald-600"
              />
              <span className="flex-1">{option.text}</span>
            </label>
          ))}
        </div>
      );

    case 'text_input':
    case 'essay':
      return (
        <div className="space-y-3">
          {question.type === 'text_input' ? (
            <Input
              placeholder="Ihre Antwort eingeben..."
              value={currentAnswer.text_answer || ''}
              onChange={(e) => onTextInput(question.id, e.target.value)}
              className="text-base"
            />
          ) : (
            <Textarea
              placeholder="Ihre ausführliche Antwort eingeben..."
              value={currentAnswer.text_answer || ''}
              onChange={(e) => onTextInput(question.id, e.target.value)}
              rows={4}
              className="text-base"
            />
          )}
        </div>
      );

    default:
      return (
        <div className="text-center py-4 text-gray-500">
          Unbekannter Fragetyp: {question.type}
        </div>
      );
  }
};

// Quiz Result Component
const QuizResult = ({ result, quiz, answers, onRetry, onComplete }) => {
  const percentage = Math.round(result.score);
  const passed = result.passed;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Result Header */}
      <Card>
        <CardContent className="p-8 text-center">
          <div className="mb-6">
            {passed ? (
              <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            ) : (
              <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            )}
            
            <h2 className={`text-3xl font-bold mb-2 ${passed ? 'text-green-600' : 'text-orange-600'}`}>
              {passed ? 'Quiz bestanden!' : 'Quiz nicht bestanden'}
            </h2>
            
            <p className="text-lg text-gray-600 mb-6">
              Sie haben {result.earned_points} von {result.max_score} Punkten erreicht
            </p>

            <div className="flex justify-center items-center gap-8 mb-6">
              <div className="text-center">
                <div className={`text-4xl font-bold ${passed ? 'text-green-600' : 'text-orange-600'}`}>
                  {percentage}%
                </div>
                <div className="text-sm text-gray-600">Erreicht</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-700">
                  {quiz.passing_score}%
                </div>
                <div className="text-sm text-gray-600">Bestehensgrenze</div>
              </div>
              
              {result.timeTaken && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-700">
                    {result.timeTaken} Min
                  </div>
                  <div className="text-sm text-gray-600">Benötigte Zeit</div>
                </div>
              )}
            </div>

            <Badge 
              className={`text-lg px-4 py-2 ${
                passed 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-orange-100 text-orange-800'
              }`}
            >
              {passed ? '✅ Bestanden' : '❌ Nicht bestanden'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Results */}
      <Card>
        <CardHeader>
          <CardTitle>Detaillierte Auswertung</CardTitle>
          <CardDescription>
            Überprüfen Sie Ihre Antworten und die korrekten Lösungen
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {quiz.questions.map((question, index) => {
              const userAnswer = answers[question.id] || { selected_options: [], text_answer: null };
              const isCorrect = checkAnswerCorrectness(question, userAnswer);
              
              return (
                <div key={question.id} className="border-l-4 pl-4 pb-4 border-gray-200">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold mt-1 ${
                      isCorrect ? 'bg-green-500' : 'bg-red-500'
                    }`}>
                      {isCorrect ? '✓' : '✗'}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium mb-2">
                        Frage {index + 1}: {question.question}
                      </h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h5 className="font-medium text-gray-700 mb-2">Ihre Antwort:</h5>
                          <div className="text-sm bg-gray-50 p-3 rounded">
                            {renderUserAnswer(question, userAnswer)}
                          </div>
                        </div>
                        
                        <div>
                          <h5 className="font-medium text-gray-700 mb-2">Korrekte Antwort:</h5>
                          <div className="text-sm bg-green-50 p-3 rounded">
                            {renderCorrectAnswer(question)}
                          </div>
                        </div>
                      </div>

                      {question.explanation && (
                        <div className="mt-3 p-3 bg-blue-50 rounded text-sm">
                          <strong>Erklärung:</strong> {question.explanation}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-center gap-4">
        {!passed && quiz.max_attempts && (
          <Button variant="outline" onClick={onRetry}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Nochmal versuchen
          </Button>
        )}
        
        <Button onClick={onComplete}>
          <CheckCircle className="w-4 h-4 mr-2" />
          Weiter zum Kurs
        </Button>
      </div>
    </div>
  );
};

// Helper Functions
const getQuestionTypeLabel = (type) => {
  const labels = {
    'single_choice': 'Einfachauswahl',
    'multiple_choice': 'Mehrfachauswahl', 
    'true_false': 'Wahr/Falsch',
    'text_input': 'Texteingabe',
    'essay': 'Essay'
  };
  return labels[type] || type;
};

const checkAnswerCorrectness = (question, userAnswer) => {
  if (question.type === 'text_input') {
    return userAnswer.text_answer?.toLowerCase().trim() === question.correct_answer?.toLowerCase().trim();
  }
  
  const correctOptions = question.options.filter(opt => opt.is_correct).map(opt => opt.id);
  const selectedOptions = userAnswer.selected_options || [];
  
  if (question.type === 'single_choice' || question.type === 'true_false') {
    return selectedOptions.length === 1 && correctOptions.includes(selectedOptions[0]);
  }
  
  if (question.type === 'multiple_choice') {
    return selectedOptions.length === correctOptions.length && 
           selectedOptions.every(id => correctOptions.includes(id));
  }
  
  return false;
};

const renderUserAnswer = (question, userAnswer) => {
  if (question.type === 'text_input' || question.type === 'essay') {
    return userAnswer.text_answer || 'Keine Antwort';
  }
  
  if (!userAnswer.selected_options || userAnswer.selected_options.length === 0) {
    return 'Keine Antwort';
  }
  
  return userAnswer.selected_options
    .map(optionId => question.options.find(opt => opt.id === optionId)?.text)
    .filter(Boolean)
    .join(', ');
};

const renderCorrectAnswer = (question) => {
  if (question.type === 'text_input') {
    return question.correct_answer || 'Keine korrekte Antwort definiert';
  }
  
  const correctOptions = question.options.filter(opt => opt.is_correct);
  return correctOptions.map(opt => opt.text).join(', ');
};

export default QuizRunner;