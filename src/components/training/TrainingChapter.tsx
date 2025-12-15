import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, X, CheckCircle } from 'lucide-react';
import { TrainingChapter as TrainingChapterType } from '../../data/trainingContent';

interface TrainingChapterProps {
  chapter: TrainingChapterType;
  onClose: () => void;
  onComplete: () => void;
}

export const TrainingChapter: React.FC<TrainingChapterProps> = ({ chapter, onClose, onComplete }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const totalSlides = chapter.slides.length;
  const slide = chapter.slides[currentSlide];
  const Icon = slide.icon;

  const handleNext = () => {
    if (currentSlide < totalSlides - 1) {
      setCurrentSlide(curr => curr + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(curr => curr - 1);
    }
  };

  const progress = ((currentSlide + 1) / totalSlides) * 100;

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between bg-emerald-50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-emerald-800 uppercase tracking-wider">
              {chapter.title}
            </span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-emerald-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-emerald-700" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-gray-100 w-full">
          <div 
            className="h-full bg-emerald-500 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 p-8 flex flex-col items-center text-center overflow-y-auto">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6 shrink-0">
            {Icon && <Icon className="w-10 h-10 text-emerald-600" />}
          </div>
          
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            {slide.title}
          </h2>
          
          <div className="text-gray-600 leading-relaxed whitespace-pre-line text-lg">
            {slide.content}
          </div>
        </div>

        {/* Footer / Navigation */}
        <div className="p-6 border-t bg-gray-50 flex items-center justify-between">
          <button 
            onClick={handlePrev}
            disabled={currentSlide === 0}
            className={`flex items-center gap-1 px-4 py-2 rounded-lg font-medium transition-colors
              ${currentSlide === 0 
                ? 'text-gray-300 cursor-not-allowed' 
                : 'text-gray-600 hover:bg-gray-200'}`}
          >
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>

          <div className="text-sm text-gray-400 font-medium">
            {currentSlide + 1} / {totalSlides}
          </div>

          <button 
            onClick={handleNext}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold text-white shadow-lg transition-all transform active:scale-95
              ${currentSlide === totalSlides - 1 
                ? 'bg-emerald-600 hover:bg-emerald-700' 
                : 'bg-emerald-500 hover:bg-emerald-600'}`}
          >
            {currentSlide === totalSlides - 1 ? (
              <>Finish <CheckCircle className="w-5 h-5" /></>
            ) : (
              <>Next <ChevronRight className="w-5 h-5" /></>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
