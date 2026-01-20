/**
 * Ranger Academy - Animation Assets Index
 * 
 * This file exports all Lottie animations for use throughout the app.
 * All animations are from LottieFiles.com (free tier)
 */

import React from 'react';
import Lottie from 'lottie-react';

// Import all Lottie JSON animations
import cameraCapture from './Camera Pop-Up.json';
import rulerMeasure from './Ruler increasing in size.json';
import arScanning from './Scan Matrix.json';
import phoneTilt from './Phone tilt animation.json';
import walking from './man walking.json';
import treeGrowing from './Tree in the wind.json';
import checkmarkSuccess from './Success.json';
import badgeEarned from './Trophy.json';
import magnifier from './Searching.json';
import helpQuestion from './Question mark.json';
import loading from './Loading 40 _ Paperplane.json';
import tapGesture from './click.json';

// Export raw animation data for custom usage
export const animations = {
  cameraCapture,
  rulerMeasure,
  arScanning,
  phoneTilt,
  walking,
  treeGrowing,
  checkmarkSuccess,
  badgeEarned,
  magnifier,
  helpQuestion,
  loading,
  tapGesture,
};

// Animation name type for type safety
export type AnimationName = keyof typeof animations;

// Props interface for the LottieAnimation component
interface LottieAnimationProps {
  name: AnimationName;
  loop?: boolean;
  autoplay?: boolean;
  style?: React.CSSProperties;
  className?: string;
  width?: number | string;
  height?: number | string;
}

/**
 * Reusable Lottie Animation Component
 * 
 * Usage:
 * <LottieAnimation name="cameraCapture" width={100} height={100} />
 */
export const LottieAnimation: React.FC<LottieAnimationProps> = ({
  name,
  loop = true,
  autoplay = true,
  style,
  className,
  width = 100,
  height = 100,
}) => {
  const animationData = animations[name];
  
  if (!animationData) {
    console.warn(`Animation "${name}" not found`);
    return null;
  }

  return (
    <Lottie
      animationData={animationData}
      loop={loop}
      autoplay={autoplay}
      style={{
        width,
        height,
        ...style,
      }}
      className={className}
    />
  );
};

// Export individual animations for direct import
export {
  cameraCapture,
  rulerMeasure,
  arScanning,
  phoneTilt,
  walking,
  treeGrowing,
  checkmarkSuccess,
  badgeEarned,
  magnifier,
  helpQuestion,
  loading,
  tapGesture,
};

// Animation catalog with metadata
export const animationCatalog = [
  {
    name: 'cameraCapture' as const,
    label: 'Camera Capture',
    description: 'Photo capture animation for camera instructions',
    useCase: 'Photo framing help, take photo tutorials',
  },
  {
    name: 'rulerMeasure' as const,
    label: 'Ruler Measure',
    description: 'Ruler extending animation for measurements',
    useCase: 'Distance measurement, calibration help',
  },
  {
    name: 'arScanning' as const,
    label: 'AR Scanning',
    description: 'Scan matrix animation for AR features',
    useCase: 'AR distance measurement, surface detection',
  },
  {
    name: 'phoneTilt' as const,
    label: 'Phone Tilt',
    description: 'Phone rotation animation',
    useCase: 'Live AR measurement instructions',
  },
  {
    name: 'walking' as const,
    label: 'Walking',
    description: 'Person walking animation',
    useCase: 'Walk-back technique tutorial',
  },
  {
    name: 'treeGrowing' as const,
    label: 'Tree Growing',
    description: 'Tree swaying in wind animation',
    useCase: 'Success screens, nature theme, welcome',
  },
  {
    name: 'checkmarkSuccess' as const,
    label: 'Success Checkmark',
    description: 'Animated green checkmark',
    useCase: 'Completion, quiz correct, save success',
  },
  {
    name: 'badgeEarned' as const,
    label: 'Badge Earned',
    description: 'Trophy/badge animation',
    useCase: 'Badge earned, level up, certification',
  },
  {
    name: 'magnifier' as const,
    label: 'Magnifier',
    description: 'Searching/magnifying glass animation',
    useCase: 'Magnifier tool help, species search',
  },
  {
    name: 'helpQuestion' as const,
    label: 'Help Question',
    description: 'Question mark animation',
    useCase: 'Help button, "Stuck?" indicator',
  },
  {
    name: 'loading' as const,
    label: 'Loading',
    description: 'Paper plane loading animation',
    useCase: 'Processing, AI analyzing, waiting states',
  },
  {
    name: 'tapGesture' as const,
    label: 'Tap Gesture',
    description: 'Click/tap hand animation',
    useCase: 'Manual marking instructions, tap here',
  },
];

export default LottieAnimation;
