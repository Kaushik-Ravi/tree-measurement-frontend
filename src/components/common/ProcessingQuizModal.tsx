// Interactive Quiz Modal for SAM Processing Wait Time
// Engages users with educational tree questions while AI analyzes their photo
// Awards 0.5 SP per correct answer, integrated with existing gamification system

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Leaf, Check, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { awardQuizPoints, formatSP } from '../../utils/spUtils';
import { getRandomQuestions, type QuizQuestion } from '../../data/quizQuestions';

interface ProcessingQuizModalProps {
  isOpen: boolean;
  estimatedSeconds?: number;
  title?: string;
}

type QuizState = 'QUESTION' | 'FEEDBACK' | 'COMPLETE';

export const ProcessingQuizModal: React.FC<ProcessingQuizModalProps> = ({
  isOpen,
  estimatedSeconds = 55,
  title = 'Analyzing Your Tree'
}) => {
  const { user } = useAuth();
  
  // Progress tracking (simulated based on typical CPU timing)
  const [progress, setProgress] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentStep, setCurrentStep] = useState('Uploading image...');
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
      const shuffled = getRandomQuestions(8); // Show max 8 questions
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
    
    // Auto-advance after 2.5 seconds
    setTimeout(() => {
      if (currentQuestionIndex < shuffledQuestions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setSelectedAnswer(null);
        setQuizState('QUESTION');
      } else {
        setQuizState('COMPLETE');
      }
    }, 2500);
  }, [quizState, shuffledQuestions, currentQuestionIndex]);
  
  // Award SP when modal closes or quiz completes
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
  
  // Award points when quiz completes
  useEffect(() => {
    if (quizState === 'COMPLETE' && !pointsAwarded) {
      awardPoints();
    }
  }, [quizState, pointsAwarded, awardPoints]);
  
  // Award points on unmount (if user navigates away)
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
      // Reset all state for next time
      setProgress(0);
      setElapsedSeconds(0);
      setCurrentStep('Uploading image...');
      setQuizState('QUESTION');
      setCurrentQuestionIndex(0);
      setShuffledQuestions([]);
      setCorrectAnswers(0);
      setTotalSPEarned(0);
      setSelectedAnswer(null);
      setPointsAwarded(false);
      startTimeRef.current = 0;
    }
  }, [isOpen]);
  
  if (!isOpen || shuffledQuestions.length === 0) return null;
  
  const currentQuestion = shuffledQuestions[currentQuestionIndex];
  const remainingSeconds = Math.max(0, estimatedSeconds - elapsedSeconds);
  const isCorrect = selectedAnswer === currentQuestion?.correctIndex;
  
  return (
    <div 
      className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 sm:p-6 z-50"
      role="dialog"
      aria-labelledby="quiz-title"
      aria-modal="true"
    >
      <div className="max-w-2xl w-full bg-gradient-to-b from-green-900/40 to-green-950/60 rounded-3xl p-6 sm:p-8 border border-green-700/30 shadow-2xl">
        
        {/* Header - Progress Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Leaf className="w-6 h-6 text-green-400 animate-pulse" aria-hidden="true" />
              <h2 id="quiz-title" className="text-xl sm:text-2xl font-bold text-white">
                {title}
              </h2>
            </div>
            <p className="text-green-300 text-sm" aria-live="polite">
              ⏳ ~{remainingSeconds}s
            </p>
          </div>
          
          {/* Progress Bar */}
          <div className="mb-2" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-2 bg-green-950/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-1000 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-green-200" aria-live="polite">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            <span>{currentStep}</span>
          </div>
        </div>
        
        {/* Divider */}
        <div className="border-t border-green-700/30 mb-6" aria-hidden="true" />
        
        {/* Quiz Section */}
        {quizState === 'QUESTION' && currentQuestion && (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-green-400 text-sm mb-2 flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                While you wait, test your tree knowledge!
              </p>
              <h3 className="text-lg sm:text-xl font-semibold text-white leading-relaxed">
                {currentQuestion.question}
              </h3>
            </div>
            
            {/* Answer Options */}
            <div className="space-y-3" role="group" aria-label="Quiz answers">
              {currentQuestion.options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAnswerSelect(idx as 0 | 1)}
                  className="w-full p-4 sm:p-5 bg-green-950/40 hover:bg-green-900/50 active:bg-green-900/70 border-2 border-green-700/40 hover:border-green-500 rounded-2xl transition-all duration-200 text-left group focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2 focus:ring-offset-black"
                  aria-label={`Option ${idx === 0 ? 'A' : 'B'}: ${option}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 flex-shrink-0 rounded-full bg-green-800/50 flex items-center justify-center text-white font-bold text-lg group-hover:bg-green-700 transition-colors">
                      {idx === 0 ? 'A' : 'B'}
                    </div>
                    <p className="text-base sm:text-lg text-white font-medium flex-1">
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
          <div className="space-y-4 text-center">
            <div 
              className={`inline-flex items-center gap-2 px-6 py-3 rounded-full ${
                isCorrect ? 'bg-green-500/20' : 'bg-blue-500/20'
              }`}
              role="status"
              aria-live="polite"
            >
              {isCorrect ? (
                <>
                  <Check className="w-6 h-6 text-green-400" aria-hidden="true" />
                  <span className="text-xl font-bold text-green-400">Correct!</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-6 h-6 text-blue-400" aria-hidden="true" />
                  <span className="text-xl font-bold text-blue-400">Great try!</span>
                </>
              )}
            </div>
            
            <div className="bg-green-950/40 rounded-2xl p-6">
              <p className="text-green-200 text-sm mb-2">🎓 Fun Fact:</p>
              <p className="text-white text-base leading-relaxed">
                {currentQuestion.fact}
              </p>
            </div>
            
            {isCorrect && (
              <div className="animate-bounce" aria-live="polite">
                <p className="text-2xl font-bold text-green-400">
                  +0.5 SP ✨
                </p>
              </div>
            )}
          </div>
        )}
        
        {/* Complete Section */}
        {quizState === 'COMPLETE' && (
          <div className="text-center space-y-4">
            <div className="text-6xl" role="img" aria-label="Celebration">🎉</div>
            <h3 className="text-2xl font-bold text-white">
              Great job learning!
            </h3>
            <div className="bg-green-500/20 rounded-2xl p-6">
              <p className="text-green-300 text-sm mb-1">You earned</p>
              <p className="text-4xl font-bold text-green-400" aria-live="polite">
                {formatSP(totalSPEarned)}
              </p>
              <p className="text-green-200 text-sm mt-2">
                {correctAnswers} of {shuffledQuestions.length} questions correct
              </p>
            </div>
            <p className="text-white/70 text-sm">
              Analysis will complete shortly...
            </p>
          </div>
        )}
        
        {/* Footer - SP Counter & Progress */}
        <div className="mt-6 pt-6 border-t border-green-700/30">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-green-400" aria-hidden="true" />
              <span className="text-green-300">
                SP Earned: <span className="font-bold text-green-400">{formatSP(totalSPEarned)}</span>
              </span>
            </div>
            {quizState !== 'COMPLETE' && (
              <span className="text-green-300" aria-live="polite">
                Question {currentQuestionIndex + 1} of {shuffledQuestions.length}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
