/**
 * HelpModal Component
 * 
 * A beautiful, step-by-step contextual help modal that displays
 * GIFs, images, and YouTube videos.
 * 
 * THEME-AWARE: Uses the app's CSS variable system for proper light/dark mode support.
 * RESPONSIVE: Works on both mobile and desktop with proper sizing and scrolling.
 */

import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Lightbulb, HelpCircle, Check } from 'lucide-react';
import { getHelpContent, type HelpContent, type HelpStep } from './helpContent';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  helpId: string;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, helpId }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [showQuickTips, setShowQuickTips] = useState(false);
  const [content, setContent] = useState<HelpContent | null>(null);

  useEffect(() => {
    if (isOpen && helpId) {
      const helpContent = getHelpContent(helpId);
      setContent(helpContent || null);
      setCurrentStepIndex(0);
      setShowQuickTips(false);
    }
  }, [isOpen, helpId]);

  if (!isOpen || !content) return null;

  const currentStep = content.steps[currentStepIndex];
  const totalSteps = content.steps.length;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;

  const handleNext = () => {
    if (!isLastStep) {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') handleNext();
    if (e.key === 'ArrowLeft') handlePrev();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="bg-background-default rounded-2xl max-w-md w-full max-h-[90vh] shadow-2xl border border-stroke-default animate-fade-in flex flex-col">
        {/* Header - Uses brand primary color */}
        <div className="bg-brand-primary px-5 py-4 flex-shrink-0 rounded-t-2xl relative">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-1.5 hover:bg-white/20 rounded-lg transition-colors z-10"
            aria-label="Close help"
          >
            <X className="w-5 h-5 text-content-on-brand" />
          </button>

          <div className="flex flex-col items-center text-center w-full">
            <h2 className="text-xl font-bold text-content-on-brand">{content.title}</h2>
            {content.subtitle && (
              <p className="text-content-on-brand/80 text-sm mt-1">{content.subtitle}</p>
            )}
          </div>

          {/* Step Indicator */}
          <div className="flex items-center gap-1.5 mt-4">
            {content.steps.map((_: HelpStep, index: number) => (
              <button
                key={index}
                onClick={() => setCurrentStepIndex(index)}
                className={`h-1.5 rounded-full transition-all ${index === currentStepIndex
                  ? 'bg-content-on-brand w-6'
                  : index < currentStepIndex
                    ? 'bg-content-on-brand/60 w-3'
                    : 'bg-content-on-brand/30 w-3'
                  }`}
                aria-label={`Go to step ${index + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Content Area - Scrollable */}
        <div className="p-5 overflow-y-auto flex-1 min-h-0">
          {/* Step Title */}
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-brand-primary/20 text-brand-primary text-xs font-semibold px-2 py-1 rounded-full">
              Step {currentStepIndex + 1}/{totalSteps}
            </span>
            <h3 className="text-lg font-semibold text-content-default">{currentStep.title}</h3>
          </div>

          {/* Media Content */}
          <div className="mb-4">
            <StepMedia step={currentStep} />
          </div>

          {/* Description */}
          <p className="text-content-subtle text-sm leading-relaxed mb-3">
            {currentStep.description}
          </p>

          {/* Tip Box */}
          {currentStep.tip && (
            <div className="flex items-start gap-2 bg-brand-accent/10 border border-brand-accent/30 rounded-lg p-3">
              <Lightbulb className="w-4 h-4 text-brand-accent flex-shrink-0 mt-0.5" />
              <p className="text-content-default text-sm">{currentStep.tip}</p>
            </div>
          )}
        </div>

        {/* Navigation Footer */}
        <div className="px-5 py-4 border-t border-stroke-default bg-background-subtle flex-shrink-0 rounded-b-2xl">
          <div className="flex items-center justify-between">
            {/* Previous Button */}
            <button
              onClick={handlePrev}
              disabled={isFirstStep}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isFirstStep
                ? 'text-content-subtle/50 cursor-not-allowed'
                : 'text-content-subtle hover:bg-background-inset hover:text-content-default'
                }`}
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            {/* Quick Tips Toggle */}
            {content.quickTips && content.quickTips.length > 0 && (
              <button
                onClick={() => setShowQuickTips(!showQuickTips)}
                className="text-xs text-brand-primary hover:text-brand-primary-hover transition-colors"
              >
                {showQuickTips ? 'Hide Tips' : 'Quick Tips'}
              </button>
            )}

            {/* Next/Done Button */}
            <button
              onClick={isLastStep ? onClose : handleNext}
              className="flex items-center gap-1 px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-content-on-brand rounded-lg text-sm font-medium transition-colors"
            >
              {isLastStep ? 'Got it!' : 'Next'}
              {!isLastStep && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>

          {/* Quick Tips Panel - Scrollable */}
          {showQuickTips && content.quickTips && (
            <div className="mt-4 pt-4 border-t border-stroke-default max-h-32 overflow-y-auto">
              <h4 className="text-sm font-semibold text-content-default mb-2">Quick Tips</h4>
              <ul className="space-y-1.5">
                {content.quickTips.map((tip: string, index: number) => (
                  <li key={index} className="flex items-start gap-2 text-xs text-content-subtle">
                    <Check className="w-3 h-3 text-brand-primary flex-shrink-0 mt-0.5" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import Lottie from 'lottie-react';
import { useLottie } from 'lottie-react';

/**
 * StepMedia Component
 * Renders the appropriate media type for each help step
 * Uses theme-aware colors for proper light/dark mode support
 */
const StepMedia: React.FC<{ step: HelpStep }> = ({ step }) => {
  const containerClass = "rounded-xl overflow-hidden bg-background-inset flex items-center justify-center min-h-[220px]";

  // Lottie Animation Loader
  const LottiePlayer = ({ url }: { url: string }) => {
    const [animationData, setAnimationData] = useState<any>(null);

    useEffect(() => {
      fetch(url)
        .then(response => response.json())
        .then(data => setAnimationData(data))
        .catch(err => console.error("Error loading Lottie:", err));
    }, [url]);

    if (!animationData) return <div className="text-content-subtle text-xs">Loading animation...</div>;

    return <Lottie animationData={animationData} loop={true} className="w-full h-full p-4" />;
  };

  switch (step.type) {
    case 'gif':
    case 'image':
      return (
        <div className={containerClass}>
          <img
            src={step.mediaUrl}
            alt={step.title}
            className="w-full h-auto max-h-[200px] object-contain"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      );

    case 'video':
      return (
        <div className={containerClass}>
          {step.videoUrl ? (
            // Local MP4 Video
            <video
              src={step.videoUrl}
              className="w-full h-full rounded-xl object-cover pointer-events-none"
              autoPlay
              loop
              muted
              playsInline
            />
          ) : step.youtubeId ? (
            // YouTube Embed
            <div className="w-full aspect-video">
              <iframe
                src={`https://www.youtube.com/embed/${step.youtubeId}?rel=0&modestbranding=1`}
                title={step.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full rounded-xl"
              />
            </div>
          ) : (
            <div className="text-content-subtle text-sm">Video unavailable</div>
          )}
        </div>
      );

    case 'lottie':
      return (
        <div className={containerClass}>
          {step.lottieUrl ? (
            <div className="w-full max-w-[280px] aspect-square">
              <LottiePlayer url={step.lottieUrl} />
            </div>
          ) : (
            <div className="text-content-subtle text-sm">Animation unavailable</div>
          )}
        </div>
      );

    case 'text':
    default:
      return (
        <div className={`${containerClass} p-6`}>
          <div className="text-center">
            <HelpCircle className="w-12 h-12 text-brand-primary mx-auto mb-2" />
          </div>
        </div>
      );
  }
};

export default HelpModal;
