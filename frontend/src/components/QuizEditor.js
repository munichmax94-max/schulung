import React, { useState } from 'react';
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Check } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';

const QuizEditor = ({ quiz, onChange }) => {
  const [quizData, setQuizData] = useState(quiz || {
    title: "",
    description: "",
    questions: [],
    passing_score: 70,
    max_attempts: null,
    time_limit_minutes: null
  });

  const updateQuiz = (updates) => {
    const newQuizData = { ...quizData, ...updates };
    setQuizData(newQuizData);
    onChange(newQuizData);
  };

  const addQuestion = () => {
    const newQuestion = {
      id: uuidv4(),
      question: "",
      type: "single_choice",
      options: [
        { id: uuidv4(), text: "", is_correct: true },
        { id: uuidv4(), text: "", is_correct: false }
      ],
      points: 1,
      explanation: ""
    };

    updateQuiz({
      questions: [...quizData.questions, newQuestion]
    });
  };

  const updateQuestion = (questionId, updates) => {
    updateQuiz({
      questions: quizData.questions.map(q => 
        q.id === questionId ? { ...q, ...updates } : q
      )
    });
  };

  const deleteQuestion = (questionId) => {
    updateQuiz({
      questions: quizData.questions.filter(q => q.id !== questionId)
    });
  };

  const addOption = (questionId) => {
    updateQuiz({
      questions: quizData.questions.map(q => 
        q.id === questionId ? {
          ...q,
          options: [...q.options, { id: uuidv4(), text: "", is_correct: false }]
        } : q
      )
    });
  };

  const updateOption = (questionId, optionId, updates) => {
    updateQuiz({
      questions: quizData.questions.map(q => 
        q.id === questionId ? {
          ...q,
          options: q.options.map(o => 
            o.id === optionId ? { ...o, ...updates } : o
          )
        } : q
      )
    });
  };

  const deleteOption = (questionId, optionId) => {
    updateQuiz({
      questions: quizData.questions.map(q => 
        q.id === questionId ? {
          ...q,
          options: q.options.filter(o => o.id !== optionId)
        } : q
      )
    });
  };

  const setCorrectOption = (questionId, optionId, questionType) => {
    updateQuiz({
      questions: quizData.questions.map(q => 
        q.id === questionId ? {
          ...q,
          options: q.options.map(o => ({
            ...o,
            is_correct: questionType === 'single_choice' ? o.id === optionId : 
                       (o.id === optionId ? !o.is_correct : o.is_correct)
          }))
        } : q
      )
    });
  };

  return (
    <div className="space-y-6">
      {/* Quiz Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Quiz-Einstellungen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="quiz-title">Quiz-Titel</Label>
            <Input
              id="quiz-title"
              value={quizData.title}
              onChange={(e) => updateQuiz({ title: e.target.value })}
              placeholder="Quiz-Titel eingeben"
            />
          </div>

          <div>
            <Label htmlFor="quiz-description">Beschreibung</Label>
            <Textarea
              id="quiz-description"
              value={quizData.description}
              onChange={(e) => updateQuiz({ description: e.target.value })}
              placeholder="Quiz-Beschreibung"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="passing-score">Bestehensgrenze (%)</Label>
              <Input
                id="passing-score"
                type="number"
                min="0"
                max="100"
                value={quizData.passing_score}
                onChange={(e) => updateQuiz({ passing_score: parseInt(e.target.value) || 70 })}
              />
            </div>

            <div>
              <Label htmlFor="max-attempts">Max. Versuche</Label>
              <Input
                id="max-attempts"
                type="number"
                min="1"
                value={quizData.max_attempts || ""}
                onChange={(e) => updateQuiz({ max_attempts: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="Unbegrenzt"
              />
            </div>

            <div>
              <Label htmlFor="time-limit">Zeitlimit (Min.)</Label>
              <Input
                id="time-limit"
                type="number"
                min="1"
                value={quizData.time_limit_minutes || ""}
                onChange={(e) => updateQuiz({ time_limit_minutes: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="Unbegrenzt"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Questions */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Fragen</CardTitle>
              <CardDescription>
                Erstellen Sie Fragen für Ihr Quiz
              </CardDescription>
            </div>
            <Button onClick={addQuestion}>
              <Plus className="w-4 h-4 mr-2" />
              Frage hinzufügen
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {quizData.questions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>Noch keine Fragen erstellt</p>
              <p className="text-sm">Fügen Sie Ihre erste Frage hinzu.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {quizData.questions.map((question, questionIndex) => (
                <Card key={question.id} className="border-l-4 border-l-emerald-500">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1 space-y-4">
                        <div>
                          <Label>Frage {questionIndex + 1}</Label>
                          <Textarea
                            value={question.question}
                            onChange={(e) => updateQuestion(question.id, { question: e.target.value })}
                            placeholder="Geben Sie Ihre Frage ein..."
                            rows={2}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label>Fragetyp</Label>
                            <Select
                              value={question.type}
                              onValueChange={(value) => updateQuestion(question.id, { type: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="single_choice">Einfachauswahl</SelectItem>
                                <SelectItem value="multiple_choice">Mehrfachauswahl</SelectItem>
                                <SelectItem value="true_false">Wahr/Falsch</SelectItem>
                                <SelectItem value="text_input">Texteingabe</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label>Punkte</Label>
                            <Input
                              type="number"
                              min="1"
                              value={question.points}
                              onChange={(e) => updateQuestion(question.id, { points: parseInt(e.target.value) || 1 })}
                            />
                          </div>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteQuestion(question.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Answer Options */}
                    {['single_choice', 'multiple_choice', 'true_false'].includes(question.type) && (
                      <div>
                        <div className="flex justify-between items-center mb-3">
                          <Label>Antwortmöglichkeiten</Label>
                          {question.type !== 'true_false' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => addOption(question.id)}
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Option
                            </Button>
                          )}
                        </div>

                        <div className="space-y-2">
                          {question.options.map((option, optionIndex) => (
                            <div key={option.id} className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => setCorrectOption(question.id, option.id, question.type)}
                                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                  option.is_correct 
                                    ? 'bg-emerald-500 border-emerald-500 text-white' 
                                    : 'border-gray-300 hover:border-emerald-300'
                                }`}
                              >
                                {option.is_correct && <Check className="w-3 h-3" />}
                              </button>

                              <Input
                                value={option.text}
                                onChange={(e) => updateOption(question.id, option.id, { text: e.target.value })}
                                placeholder={`Option ${optionIndex + 1}`}
                                className="flex-1"
                              />

                              {question.type !== 'true_false' && question.options.length > 2 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteOption(question.id, option.id)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Text Input Answer */}
                    {question.type === 'text_input' && (
                      <div>
                        <Label>Korrekte Antwort</Label>
                        <Input
                          value={question.correct_answer || ""}
                          onChange={(e) => updateQuestion(question.id, { correct_answer: e.target.value })}
                          placeholder="Geben Sie die korrekte Antwort ein..."
                        />
                      </div>
                    )}

                    {/* Explanation */}
                    <div>
                      <Label>Erklärung (optional)</Label>
                      <Textarea
                        value={question.explanation || ""}
                        onChange={(e) => updateQuestion(question.id, { explanation: e.target.value })}
                        placeholder="Erklärung zur richtigen Antwort..."
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default QuizEditor;