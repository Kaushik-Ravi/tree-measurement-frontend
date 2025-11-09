// Interactive Quiz Inline Component for SAM Processing Wait Time
// Integrates into existing photo measurement UI/UX
// Awards 0.5 SP per correct answer, auto-dismisses when processing completes

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { awardQuizPoints, formatSP } from '../../utils/spUtils';
import { getRandomQuestions, type QuizQuestion } from '../../data/quizQuestions';

interface ProcessingQuizModalProps {
  isOpen: boolean;
  estimatedSeconds?: number;
  title?: string;
}

type QuizState = 'QUESTION' | 'FEEDBACK';

export const ProcessingQuizModal: React.FC<ProcessingQuizModalProps> = ({
  isOpen,
  estimatedSeconds = 55,
  title = 'Analyzing Your Tree'
}) => {
  const { user } = useAuth();
  
  // Progress tracking (simulated based on typical CPU timing)
  const [progress, setProgress] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentStep, setCurrentStep] = useState('Preprocessing image...');
  const startTimeRef = useRef<number>(0);
  
  // Quiz state
  const [quizState, setQuizState] = useState<QuizState>('QUESTION');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [shuffledQuestions, setShuffledQuestions] = useState<QuizQuestion[]>([]);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [totalSPEarned, setTotalSPEarned] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<0 | 1 | null>(null);
  const [pointsAwarded, setPointsAwarded] = useState(false);
  
  // Shuffle questions on mount
  useEffect(() => {
    if (isOpen && shuffledQuestions.length === 0) {
      startTimeRef.current = Date.now();
      const shuffled = getRandomQuestions(12); // Get all 12 questions, no limit
      setShuffledQuestions(shuffled);
    }
  }, [isOpen, shuffledQuestions.length]);
  
  // Progress simulation (realistic for CPU timing)
  useEffect(() => {
    if (!isOpen) return;
    
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      setElapsedSeconds(Math.floor(elapsed));
      
      // Simulate realistic progress based on CPU timings
      let newProgress = 0;
      let newStep = '';
      
      if (elapsed < 5) {
        newProgress = 10;
        newStep = 'Uploading image...';
      } else if (elapsed < 10) {
        newProgress = 15;
        newStep = 'Preprocessing image...';
      } else if (elapsed < 30) {
        newProgress = 15 + ((elapsed - 10) / 20) * 35; // 15% → 50%
        newStep = 'AI analyzing trunk structure...';
      } else if (elapsed < 48) {
        newProgress = 50 + ((elapsed - 30) / 18) * 35; // 50% → 85%
        newStep = 'Detecting tree boundaries...';
      } else {
        newProgress = Math.min(95, 85 + ((elapsed - 48) / 7) * 10);
        newStep = 'Finalizing measurements...';
      }
      
      setProgress(Math.floor(newProgress));
      setCurrentStep(newStep);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isOpen]);
  
  // Handle answer selection
  const handleAnswerSelect = useCallback((answerIndex: 0 | 1) => {
    if (quizState !== 'QUESTION') return;
    
    setSelectedAnswer(answerIndex);
    setQuizState('FEEDBACK');
    
    const currentQuestion = shuffledQuestions[currentQuestionIndex];
    const isCorrect = answerIndex === currentQuestion.correctIndex;
    
    if (isCorrect) {
      setCorrectAnswers(prev => prev + 1);
      setTotalSPEarned(prev => prev + 0.5);
    }
    
    // Auto-advance after 5 seconds to give time to read the fun fact
    setTimeout(() => {
      if (currentQuestionIndex < shuffledQuestions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setSelectedAnswer(null);
        setQuizState('QUESTION');
      } else {
        // No more questions, just stay on last feedback
        setSelectedAnswer(null);
      }
    }, 5000);
  }, [quizState, shuffledQuestions, currentQuestionIndex]);
  
  // Award SP when modal closes (processing complete)
  const awardPoints = useCallback(async () => {
    if (pointsAwarded || correctAnswers === 0 || !user) return;
    
    console.log(`[Quiz] Awarding ${correctAnswers} correct answers (${totalSPEarned} SP)`);
    setPointsAwarded(true);
    
    try {
      const result = await awardQuizPoints(correctAnswers);
      if (result.status === 'success') {
        console.log(`[Quiz] Successfully awarded ${result.points_awarded} SP`);
      } else {
        console.error('[Quiz] Failed to award points:', result.message);
      }
    } catch (error) {
      console.error('[Quiz] Error awarding points:', error);
    }
  }, [correctAnswers, totalSPEarned, pointsAwarded, user]);
  
  // Award points on unmount (when processing completes and modal closes)
  useEffect(() => {
    return () => {
      if (!pointsAwarded && correctAnswers > 0 && user) {
        // Award points on cleanup
        awardQuizPoints(correctAnswers).catch(console.error);
      }
    };
  }, [pointsAwarded, correctAnswers, user]);
  
  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      // Award points before reset
      if (!pointsAwarded && correctAnswers > 0 && user) {
        awardPoints();
      }
      
      // Reset all state for next time
      setTimeout(() => {
        setProgress(0);
        setElapsedSeconds(0);
        setCurrentStep('Preprocessing image...');
        setQuizState('QUESTION');
        setCurrentQuestionIndex(0);
        setShuffledQuestions([]);
        setCorrectAnswers(0);
        setTotalSPEarned(0);
        setSelectedAnswer(null);
        setPointsAwarded(false);
        startTimeRef.current = 0;
      }, 100);
    }
  }, [isOpen, awardPoints, correctAnswers, pointsAwarded, user]);
  
  if (!isOpen || shuffledQuestions.length === 0) return null;
  
  const currentQuestion = shuffledQuestions[currentQuestionIndex];
  const remainingSeconds = Math.max(0, estimatedSeconds - elapsedSeconds);
  const isCorrect = selectedAnswer === currentQuestion?.correctIndex;
  
  // Inline component matching existing UI/UX
  return (
    <div className="space-y-4">
      {/* Progress Section - matches "Current Task" box styling */}
      <div className="p-4 rounded-lg bg-background-subtle border border-stroke-subtle">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-content-default">{title}</h3>
          <span className="text-xs text-content-subtle">⏳ ~{remainingSeconds}s</span>
        </div>
        
        {/* Progress Bar */}
        <div className="mb-2">
          <div className="h-2 bg-background-default rounded-full overflow-hidden">
            <div 
              className="h-full bg-brand-primary transition-all duration-1000 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        
        <p className="text-xs text-content-subtle">{currentStep}</p>
      </div>
      
      {/* Quiz Section - matches existing card styling */}
      <div className="p-4 rounded-lg bg-background-subtle border border-stroke-subtle">
        {quizState === 'QUESTION' && currentQuestion && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-brand-secondary mt-1 flex-shrink-0" />
              <p className="text-sm text-brand-secondary font-medium">
                While you wait, test your tree knowledge!
              </p>
            </div>
            
            <h4 className="text-base font-semibold text-content-default leading-relaxed">
              {currentQuestion.question}
            </h4>
            
            {/* Answer Options - matching existing button styling */}
            <div className="space-y-2">
              {currentQuestion.options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAnswerSelect(idx as 0 | 1)}
                  className="w-full p-3 bg-background-default hover:bg-brand-primary/10 active:bg-brand-primary/20 border border-stroke-default hover:border-brand-primary rounded-lg transition-all text-left focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 flex-shrink-0 rounded-full bg-brand-primary/20 flex items-center justify-center text-brand-primary font-bold text-sm">
                      {idx === 0 ? 'A' : 'B'}
                    </div>
                    <p className="text-sm text-content-default font-medium flex-1">
                      {option}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Feedback Section */}
        {quizState === 'FEEDBACK' && currentQuestion && selectedAnswer !== null && (
          <div className="space-y-3">
            <div 
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${
                isCorrect ? 'bg-status-success/20' : 'bg-brand-secondary/20'
              }`}
            >
              {isCorrect ? (
                <>
                  <Check className="w-5 h-5 text-status-success" />
                  <span className="text-sm font-bold text-status-success">Correct!</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-brand-secondary" />
                  <span className="text-sm font-bold text-brand-secondary">Great try!</span>
                </>
              )}
            </div>
            
            <div className="p-3 bg-background-default rounded-lg border border-stroke-default">
              <p className="text-xs text-content-subtle mb-1">🎓 Fun Fact:</p>
              <p className="text-sm text-content-default leading-relaxed">
                {currentQuestion.fact}
              </p>
            </div>
            
            {isCorrect && (
              <div className="text-center">
                <p className="text-lg font-bold text-brand-primary animate-bounce">
                  +0.5 SP ✨
                </p>
              </div>
            )}
          </div>
        )}
        
        {/* Footer - SP Counter */}
        <div className="mt-4 pt-3 border-t border-stroke-default">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-brand-primary" />
              <span className="text-content-subtle">
                SP Earned: <span className="font-bold text-brand-primary">{formatSP(totalSPEarned)}</span>
              </span>
            </div>
            <span className="text-content-subtle">
              Question {currentQuestionIndex + 1} of {shuffledQuestions.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
