/**
 * HelpButton Component
 * 
 * A contextual help button that opens step-by-step guidance.
 * Designed to be subtle and professional - doesn't compete with primary actions.
 * 
 * THEME-AWARE: Uses the app's CSS variable system for proper light/dark mode support.
 * RESPONSIVE: Works on both mobile and desktop.
 */

import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import HelpModal from './HelpModal';

type ButtonVariant = 'inline' | 'minimal' | 'text-link';
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
  /** Custom className for additional styling */
  className?: string;
}

export const HelpButton: React.FC<HelpButtonProps> = ({
  helpId,
  variant = 'inline',
  size = 'md',
  label = 'Need help?',
  className = '',
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClick = () => {
    setIsModalOpen(true);
  };

  // Size classes
  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 20,
  };

  // Render based on variant
  switch (variant) {
    case 'inline':
      // Subtle inline button - sits naturally in content flow
      return (
        <>
          <button
            onClick={handleClick}
            className={`
              inline-flex items-center gap-1.5 py-2 px-3
              text-content-subtle hover:text-brand-primary
              hover:bg-brand-primary/5
              border border-transparent hover:border-brand-primary/20
              rounded-lg
              transition-all duration-200
              ${sizeClasses[size]}
              ${className}
            `}
            aria-label={label}
          >
            <HelpCircle 
              className="flex-shrink-0" 
              style={{ width: iconSizes[size], height: iconSizes[size] }} 
            />
            <span>{label}</span>
          </button>
          <HelpModal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
            helpId={helpId} 
          />
        </>
      );

    case 'minimal':
      // Icon-only button - for tight spaces
      return (
        <>
          <button
            onClick={handleClick}
            className={`
              p-1.5 rounded-full
              text-content-subtle hover:text-brand-primary
              hover:bg-brand-primary/10
              transition-all duration-200
              ${className}
            `}
            aria-label={label}
            title={label}
          >
            <HelpCircle style={{ width: iconSizes[size], height: iconSizes[size] }} />
          </button>
          <HelpModal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
            helpId={helpId} 
          />
        </>
      );

    case 'text-link':
      // Text link style - very subtle, blends with content
      return (
        <>
          <button
            onClick={handleClick}
            className={`
              inline-flex items-center gap-1
              text-brand-primary hover:text-brand-primary-hover
              hover:underline underline-offset-2
              transition-colors duration-200
              ${sizeClasses[size]}
              ${className}
            `}
            aria-label={label}
          >
            <HelpCircle 
              className="flex-shrink-0" 
              style={{ width: iconSizes[size], height: iconSizes[size] }} 
            />
            <span>{label}</span>
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
 * Quick access help icon - just an icon with tooltip
 */
export const HelpIcon: React.FC<{ helpId: string; className?: string; tooltip?: string }> = ({ 
  helpId, 
  className = '',
  tooltip = 'Need help?'
}) => {
  return (
    <HelpButton 
      helpId={helpId} 
      variant="minimal" 
      size="sm" 
      className={className}
      label={tooltip}
    />
  );
};

export default HelpButton;
