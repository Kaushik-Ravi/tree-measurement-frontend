import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, CheckCircle, Maximize2, CheckSquare, Square } from 'lucide-react';
import { TrainingChapter as TrainingChapterType } from '../../data/trainingContent';

interface TrainingChapterProps {
  chapter: TrainingChapterType;
  onClose: () => void;
  onComplete: () => void;
}

export const TrainingChapter: React.FC<TrainingChapterProps> = ({ chapter, onClose, onComplete }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [isFullscreen, setIsFullscreen] = useState(false);

  const totalSlides = chapter.slides.length;
  const slide = chapter.slides[currentSlide];
  const Icon = slide.icon;

  // Reset checked items when slide changes
  useEffect(() => {
    setCheckedItems(new Set());
  }, [currentSlide]);

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

  const toggleCheck = (item: string) => {
    const newChecked = new Set(checkedItems);
    if (newChecked.has(item)) {
      newChecked.delete(item);
    } else {
      newChecked.add(item);
    }
    setCheckedItems(newChecked);
  };

  const isNextDisabled = () => {
    if (slide.type === 'checklist') {
      return slide.checklistItems && checkedItems.size !== slide.checklistItems.length;
    }
    return false;
  };

  const progress = ((currentSlide + 1) / totalSlides) * 100;

  const renderContent = () => {
    switch (slide.type) {
      case 'pdf':
        return (
          <div className="w-full h-full flex flex-col">
            <div className="flex justify-end mb-2">
              <button 
                onClick={() => window.open(slide.src, '_blank')}
                className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium"
              >
                <Maximize2 className="w-4 h-4" /> Open Fullscreen
              </button>
            </div>
            {/* Use embed for better mobile support than iframe */}
            <embed 
              src={slide.src} 
              type="application/pdf"
              className="w-full flex-1 rounded-lg border border-gray-200 dark:border-gray-700 shadow-inner bg-gray-50 dark:bg-gray-800"
            />
            <p className="text-xs text-gray-400 mt-2 text-center">
              Tip: If the PDF doesn't load, click "Open Fullscreen" to view it in your browser.
            </p>
          </div>
        );

      case 'video':
        return (
          <div className="w-full h-full flex flex-col justify-center">
             <div className="w-full aspect-video rounded-xl overflow-hidden shadow-lg bg-black">
              <iframe 
                src={slide.src} 
                className="w-full h-full"
                title="Video Player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen
              />
            </div>
          </div>
        );

      case 'image':
        return (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-xl p-2 border border-gray-100 dark:border-gray-800">
            <img 
              src={slide.src} 
              alt={slide.title} 
              className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
            />
            <button 
              onClick={() => window.open(slide.src, '_blank')}
              className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1"
            >
              <Maximize2 className="w-3 h-3" /> Tap to zoom
            </button>
          </div>
        );

      case 'checklist':
        return (
          <div className="w-full max-w-md space-y-3 mt-4">
            {slide.checklistItems?.map((item, idx) => (
              <button
                key={idx}
                onClick={() => toggleCheck(item)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-start gap-3
                  ${checkedItems.has(item) 
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-100' 
                    : 'border-gray-200 dark:border-gray-700 hover:border-emerald-200 dark:hover:border-emerald-800 text-gray-700 dark:text-gray-300'}`}
              >
                <div className={`mt-0.5 shrink-0 ${checkedItems.has(item) ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-300 dark:text-gray-600'}`}>
                  {checkedItems.has(item) ? <CheckSquare className="w-6 h-6" /> : <Square className="w-6 h-6" />}
                </div>
                <span className="font-medium leading-relaxed">{item}</span>
              </button>
            ))}
          </div>
        );

      default: // text
        return (
          <div className="text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line text-lg max-w-prose">
            {slide.content}
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className={`bg-white dark:bg-gray-900 w-full ${slide.type === 'pdf' || slide.type === 'image' ? 'max-w-4xl h-[85vh]' : 'max-w-lg max-h-[90vh]'} rounded-2xl overflow-hidden shadow-2xl flex flex-col transition-all duration-300`}>
        
        {/* Header */}
        <div className="p-4 border-b dark:border-gray-800 flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-emerald-800 dark:text-emerald-200 uppercase tracking-wider">
              {chapter.title}
            </span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-full transition-colors">
            <X className="w-5 h-5 text-emerald-700 dark:text-emerald-300" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-gray-100 dark:bg-gray-800 w-full shrink-0">
          <div 
            className="h-full bg-emerald-500 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Content Container */}
        <div className="flex-1 p-6 flex flex-col items-center overflow-y-auto">
          {/* Icon & Title (Only show for non-media slides to save space) */}
          {slide.type !== 'pdf' && slide.type !== 'image' && (
            <>
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-4 shrink-0">
                {Icon && <Icon className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />}
              </div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2 text-center">
                {slide.title}
              </h2>
              {slide.content && slide.type !== 'text' && (
                <p className="text-gray-500 dark:text-gray-400 text-center mb-6 max-w-md">
                  {slide.content}
                </p>
              )}
            </>
          )}

          {/* Render the specific slide type */}
          {renderContent()}
        </div>

        {/* Footer / Navigation */}
        <div className="p-6 border-t dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex items-center justify-between shrink-0">
          <button 
            onClick={handlePrev}
            disabled={currentSlide === 0}
            className={`flex items-center gap-1 px-4 py-2 rounded-lg font-medium transition-colors
              ${currentSlide === 0 
                ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' 
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800'}`}
          >
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>

          <div className="text-sm text-gray-400 dark:text-gray-500 font-medium">
            {currentSlide + 1} / {totalSlides}
          </div>

          <button 
            onClick={handleNext}
            disabled={isNextDisabled()}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold text-white shadow-lg transition-all transform active:scale-95
              ${currentSlide === totalSlides - 1 
                ? 'bg-emerald-600 hover:bg-emerald-700' 
                : 'bg-emerald-500 hover:bg-emerald-600'}
              ${isNextDisabled() ? 'opacity-50 cursor-not-allowed bg-gray-400 hover:bg-gray-400 shadow-none' : ''}
            `}
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
