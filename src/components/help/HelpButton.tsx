/**
 * HelpButton Component
 * 
 * A floating "Stuck? Here to Help!" button that opens contextual help.
 * Can be placed anywhere in the app with different styles.
 * 
 * THEME-AWARE: Uses the app's CSS variable system for proper light/dark mode support.
 * RESPONSIVE: Works on both mobile and desktop with safe-area-inset support.
 */

import React, { useState } from 'react';
import { HelpCircle, Sparkles } from 'lucide-react';
import { LottieAnimation } from '../../assets/animations';
import HelpModal from './HelpModal';

type ButtonVariant = 'floating' | 'inline' | 'minimal' | 'banner';
type ButtonSize = 'sm' | 'md' | 'lg';

interface HelpButtonProps {
  /** The help content ID to display (e.g., 'photo-capture', 'calibration') */
  helpId: string;
  /** Button style variant */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Custom label text */
  label?: string;
  /** Show animated icon */
  animated?: boolean;
  /** Custom className for additional styling */
  className?: string;
  /** Position for floating variant */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'bottom-center';
  /** Whether to hide on mobile (for when there's a floating action button) */
  hideOnMobile?: boolean;
}

export const HelpButton: React.FC<HelpButtonProps> = ({
  helpId,
  variant = 'floating',
  size = 'md',
  label = 'Stuck? Here to Help!',
  animated = true,
  className = '',
  position = 'bottom-right',
  hideOnMobile = false,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    setIsModalOpen(true);
  };

  // Size classes
  const sizeClasses = {
    sm: 'text-xs px-2.5 py-1.5',
    md: 'text-sm px-3.5 py-2',
    lg: 'text-base px-5 py-3',
  };

  const iconSizes = {
    sm: 14,
    md: 18,
    lg: 22,
  };

  // Position classes for floating variant - mobile-safe with env(safe-area-inset-bottom)
  const positionClasses = {
    'bottom-right': 'right-4 md:bottom-4',
    'bottom-left': 'left-4 md:bottom-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-center': 'left-1/2 -translate-x-1/2 md:bottom-4',
  };

  // Mobile-responsive visibility class
  const mobileVisibilityClass = hideOnMobile ? 'hidden md:flex' : 'flex';

  // Render based on variant
  switch (variant) {
    case 'floating':
      return (
        <>
          <button
            onClick={handleClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`
              fixed ${positionClasses[position]} z-40
              ${mobileVisibilityClass} items-center gap-2
              bg-brand-primary hover:bg-brand-primary-hover
              text-content-on-brand font-medium rounded-full
              shadow-lg
              transition-all duration-300 ease-out
              ${isHovered ? 'scale-105' : 'scale-100'}
              ${sizeClasses[size]}
              ${className}
            `}
            style={{
              // Mobile-safe positioning: respect browser UI and safe areas
              bottom: position.startsWith('bottom') ? 'max(80px, calc(1rem + env(safe-area-inset-bottom, 0px)))' : undefined,
            }}
            aria-label={label}
          >
            {animated && isHovered ? (
              <LottieAnimation 
                name="helpQuestion" 
                width={iconSizes[size]} 
                height={iconSizes[size]}
                loop={true}
              />
            ) : (
              <HelpCircle className="flex-shrink-0" style={{ width: iconSizes[size], height: iconSizes[size] }} />
            )}
            <span className="whitespace-nowrap">{label}</span>
            {animated && (
              <Sparkles 
                className="flex-shrink-0 animate-pulse" 
                style={{ width: iconSizes[size] * 0.8, height: iconSizes[size] * 0.8 }} 
              />
            )}
          </button>
          <HelpModal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
            helpId={helpId} 
          />
        </>
      );

    case 'inline':
      return (
        <>
          <button
            onClick={handleClick}
            className={`
              inline-flex items-center gap-1.5
              text-brand-primary hover:text-brand-primary-hover
              transition-colors duration-200
              ${sizeClasses[size]}
              ${className}
            `}
            aria-label={label}
          >
            <HelpCircle className="flex-shrink-0" style={{ width: iconSizes[size], height: iconSizes[size] }} />
            <span className="underline underline-offset-2">{label}</span>
          </button>
          <HelpModal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
            helpId={helpId} 
          />
        </>
      );

    case 'minimal':
      return (
        <>
          <button
            onClick={handleClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`
              p-2 rounded-full
              text-content-subtle hover:text-brand-primary
              hover:bg-brand-primary/10
              transition-all duration-200
              ${className}
            `}
            aria-label={label}
            title={label}
          >
            {animated && isHovered ? (
              <LottieAnimation 
                name="helpQuestion" 
                width={iconSizes[size]} 
                height={iconSizes[size]}
                loop={true}
              />
            ) : (
              <HelpCircle style={{ width: iconSizes[size], height: iconSizes[size] }} />
            )}
          </button>
          <HelpModal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
            helpId={helpId} 
          />
        </>
      );

    case 'banner':
      return (
        <>
          <button
            onClick={handleClick}
            className={`
              w-full flex items-center justify-center gap-2
              bg-background-subtle hover:bg-background-inset
              border border-stroke-default hover:border-brand-primary/50
              text-content-default hover:text-brand-primary
              rounded-xl py-3 px-4
              transition-all duration-300
              ${className}
            `}
            aria-label={label}
          >
            <HelpCircle className="w-5 h-5 text-brand-primary" />
            <span className="font-medium">{label}</span>
            <Sparkles className="w-4 h-4 text-brand-accent animate-pulse" />
          </button>
          <HelpModal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
            helpId={helpId} 
          />
        </>
      );

    default:
      return null;
  }
};

/**
 * Quick access help button - just an icon
 */
export const HelpIcon: React.FC<{ helpId: string; className?: string }> = ({ 
  helpId, 
  className = '' 
}) => {
  return (
    <HelpButton 
      helpId={helpId} 
      variant="minimal" 
      size="sm" 
      className={className}
      label="Need help?"
      animated={false}
    />
  );
};

export default HelpButton;
