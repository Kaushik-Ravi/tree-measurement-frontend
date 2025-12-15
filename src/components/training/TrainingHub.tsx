import React, { useState, useEffect } from 'react';
import { ArrowLeft, GraduationCap, CheckCircle, Lock, PlayCircle, Award } from 'lucide-react';
import { trainingModules } from '../../data/trainingContent';
import { TrainingChapter } from './TrainingChapter';

interface TrainingHubProps {
  onBack: () => void;
}

export const TrainingHub: React.FC<TrainingHubProps> = ({ onBack }) => {
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [completedChapters, setCompletedChapters] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('tree_app_training_progress');
    if (saved) {
      setCompletedChapters(JSON.parse(saved));
    }
  }, []);

  const handleChapterComplete = (chapterId: string) => {
    const newCompleted = [...new Set([...completedChapters, chapterId])];
    setCompletedChapters(newCompleted);
    localStorage.setItem('tree_app_training_progress', JSON.stringify(newCompleted));
    setActiveChapterId(null);
  };

  const activeChapter = trainingModules.find(m => m.id === activeChapterId);
  const allComplete = trainingModules.every(m => completedChapters.includes(m.id));

  if (activeChapter) {
    return (
      <TrainingChapter 
        chapter={activeChapter} 
        onClose={() => setActiveChapterId(null)}
        onComplete={() => handleChapterComplete(activeChapter.id)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-emerald-600 dark:bg-emerald-800 text-white p-6 shadow-lg">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-emerald-100 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" /> Back to App
        </button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <GraduationCap className="w-8 h-8" />
              Training Academy
            </h1>
            <p className="text-emerald-100 mt-2">
              Master the art of tree measurement and become a Certified Ranger.
            </p>
          </div>
          
          {allComplete && (
            <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg flex items-center gap-2 border border-white/30">
              <Award className="w-6 h-6 text-yellow-300" />
              <span className="font-bold text-white">Certified Ranger</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 max-w-3xl mx-auto w-full">
        
        {/* Progress Overview */}
        <div className="mb-8">
          <div className="flex justify-between text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
            <span>Your Progress</span>
            <span>{Math.round((completedChapters.length / trainingModules.length) * 100)}%</span>
          </div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${(completedChapters.length / trainingModules.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Chapter List */}
        <div className="space-y-4">
          {trainingModules.map((module, index) => {
            const isCompleted = completedChapters.includes(module.id);
            const isLocked = index > 0 && !completedChapters.includes(trainingModules[index - 1].id);
            const Icon = module.icon;

            return (
              <button
                key={module.id}
                onClick={() => !isLocked && setActiveChapterId(module.id)}
                disabled={isLocked}
                className={`w-full text-left bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border-2 transition-all
                  ${isLocked 
                    ? 'border-gray-100 dark:border-gray-700 opacity-60 cursor-not-allowed' 
                    : 'border-transparent hover:border-emerald-500 dark:hover:border-emerald-500 hover:shadow-md cursor-pointer'}
                  ${isCompleted ? 'bg-emerald-50/50 dark:bg-emerald-900/20' : ''}
                `}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg shrink-0 ${isCompleted ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                    {isCompleted ? <CheckCircle className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className={`font-bold text-lg ${isCompleted ? 'text-emerald-800 dark:text-emerald-300' : 'text-gray-800 dark:text-white'}`}>
                        {module.title}
                      </h3>
                      {isLocked && <Lock className="w-4 h-4 text-gray-400 dark:text-gray-500" />}
                      {!isLocked && !isCompleted && <PlayCircle className="w-5 h-5 text-emerald-500" />}
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                      {module.description}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer Message */}
        {allComplete ? (
          <div className="mt-8 p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl text-center">
            <h3 className="text-xl font-bold text-yellow-800 dark:text-yellow-200 mb-2">🎉 Congratulations!</h3>
            <p className="text-yellow-700 dark:text-yellow-300">
              You have completed all training modules. You are now ready to contribute scientific data to the Community Grove.
            </p>
          </div>
        ) : (
          <div className="mt-8 text-center text-gray-400 dark:text-gray-500 text-sm">
            Complete all chapters to unlock your badge.
          </div>
        )}

      </div>
    </div>
  );
};
