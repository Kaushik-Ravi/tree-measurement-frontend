// src/utils/live-ar/trigonometry.ts
/**
 * Trigonometry Utilities for Live AR Tree Measurement
 * 
 * This module implements the two-angle measurement algorithm
 * that eliminates the need for user height calibration.
 * 
 * Mathematical Foundation:
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 *         🌲 Tree Top
 *         /|
 *    θ₂  / |
 *       /  | ← Tree Height (H)
 *      /   |
 *  📱 ─────┴─ Tree Base
 *   ╲  D   
 *  θ₁╲
 *     🦶 User Position
 * 
 * Given:
 * - D = horizontal distance from user to tree (meters)
 * - θ₁ = angle from horizontal to tree base (negative, looking down)
 * - θ₂ = angle from horizontal to tree top (positive, looking up)
 * 
 * Tree Height = D × tan(θ₂) + D × tan(|θ₁|)
 *             = D × (tan(θ₂) + tan(|θ₁|))
 * 
 * Why This Works:
 * The user's eye level height cancels out because we measure
 * both angles relative to the same horizontal plane. This means
 * the system works for anyone - children, adults, wheelchair users.
 */

/**
 * Measurement accuracy constants
 */
export const MEASUREMENT_CONSTANTS = {
  /** Minimum acceptable distance to tree (meters) */
  MIN_DISTANCE: 3.0,
  
  /** Maximum acceptable distance to tree (meters) */
  MAX_DISTANCE: 50.0,
  
  /** Minimum angle difference for valid measurement (degrees) */
  MIN_ANGLE_DIFFERENCE: 5.0,
  
  /** Maximum tilt angle (degrees) - beyond this, accuracy degrades */
  MAX_TILT_ANGLE: 85.0,
  
  /** Expected measurement accuracy (percentage) */
  ACCURACY_MARGIN: 0.15, // ±15%
} as const;

/**
 * 3D Point in space
 */
export interface Point3D {
  x: number;
  y: number;
  z: number;
}

/**
 * Tree measurement result
 */
export interface TreeMeasurement {
  height: number;           // meters
  confidence: number;       // 0-1 scale
  angleToTop: number;      // degrees
  angleToBase: number;     // degrees
  distance: number;        // meters
  timestamp: number;       // milliseconds since epoch
}

/**
 * Calculates tree height using two-angle trigonometry
 * 
 * @param distance - Horizontal distance from user to tree (meters)
 * @param angleToTop - Angle from horizontal to tree top (degrees, positive)
 * @param angleToBase - Angle from horizontal to tree base (degrees, negative)
 * @returns Tree height in meters
 * 
 * @example
 * const height = calculateTreeHeight(10, 45, -5);
 * // height ≈ 10.88 meters
 */
export const calculateTreeHeight = (
  distance: number,
  angleToTop: number,
  angleToBase: number
): number => {
  // Validate inputs
  if (distance <= 0) {
    throw new Error('Distance must be positive');
  }
  
  if (distance < MEASUREMENT_CONSTANTS.MIN_DISTANCE) {
    console.warn(`Distance ${distance}m is below recommended minimum of ${MEASUREMENT_CONSTANTS.MIN_DISTANCE}m`);
  }
  
  if (distance > MEASUREMENT_CONSTANTS.MAX_DISTANCE) {
    console.warn(`Distance ${distance}m exceeds recommended maximum of ${MEASUREMENT_CONSTANTS.MAX_DISTANCE}m`);
  }

  // Convert angles to radians
  const topRad = (angleToTop * Math.PI) / 180;
  const baseRad = (Math.abs(angleToBase) * Math.PI) / 180;

  // Validate angles
  if (Math.abs(angleToTop) > MEASUREMENT_CONSTANTS.MAX_TILT_ANGLE) {
    throw new Error(`Top angle ${angleToTop}° exceeds maximum tilt of ${MEASUREMENT_CONSTANTS.MAX_TILT_ANGLE}°`);
  }

  // Calculate height using two-angle formula
  const height = distance * (Math.tan(topRad) + Math.tan(baseRad));

  // Prevent negative heights (sensor error)
  return Math.max(0, height);
};

/**
 * Calculates measurement confidence score
 * 
 * Confidence is based on:
 * - Distance (optimal range: 5-20m)
 * - Angle difference (larger is better, min 5°)
 * - Angle extremes (avoid near-vertical shots)
 * 
 * @param distance - Distance to tree (meters)
 * @param angleToTop - Top angle (degrees)
 * @param angleToBase - Base angle (degrees)
 * @returns Confidence score (0-1, where 1 is highest confidence)
 */
export const calculateConfidence = (
  distance: number,
  angleToTop: number,
  angleToBase: number
): number => {
  let confidence = 1.0;

  // Distance factor (optimal: 5-20m)
  if (distance < 5) {
    confidence *= 0.7; // Too close
  } else if (distance > 20) {
    confidence *= Math.max(0.5, 1 - (distance - 20) / 30); // Too far
  }

  // Angle difference factor
  const angleDiff = angleToTop - angleToBase;
  if (angleDiff < MEASUREMENT_CONSTANTS.MIN_ANGLE_DIFFERENCE) {
    confidence *= 0.6; // Angles too similar
  }

  // Extreme angle penalty
  if (Math.abs(angleToTop) > 70) {
    confidence *= 0.7; // Top angle too steep
  }
  if (Math.abs(angleToBase) > 30) {
    confidence *= 0.8; // Base angle too steep
  }

  return Math.max(0, Math.min(1, confidence));
};

/**
 * Creates a complete tree measurement with validation
 * 
 * @param distance - Distance to tree (meters)
 * @param angleToTop - Top angle (degrees)
 * @param angleToBase - Base angle (degrees)
 * @returns TreeMeasurement object
 */
export const createMeasurement = (
  distance: number,
  angleToTop: number,
  angleToBase: number
): TreeMeasurement => {
  const height = calculateTreeHeight(distance, angleToTop, angleToBase);
  const confidence = calculateConfidence(distance, angleToTop, angleToBase);

  return {
    height: parseFloat(height.toFixed(2)),
    confidence: parseFloat(confidence.toFixed(2)),
    angleToTop: parseFloat(angleToTop.toFixed(1)),
    angleToBase: parseFloat(angleToBase.toFixed(1)),
    distance: parseFloat(distance.toFixed(2)),
    timestamp: Date.now(),
  };
};

/**
 * Validates if a measurement is acceptable
 * 
 * @param measurement - Tree measurement to validate
 * @returns { valid: boolean, reason?: string }
 */
export const validateMeasurement = (
  measurement: TreeMeasurement
): { valid: boolean; reason?: string } => {
  if (measurement.height <= 0) {
    return { valid: false, reason: 'Height must be positive' };
  }

  if (measurement.height > 100) {
    return { valid: false, reason: 'Height exceeds realistic maximum (100m)' };
  }

  if (measurement.confidence < 0.5) {
    return { 
      valid: false, 
      reason: 'Low confidence - try adjusting distance or angles' 
    };
  }

  if (measurement.distance < MEASUREMENT_CONSTANTS.MIN_DISTANCE) {
    return { 
      valid: false, 
      reason: `Distance too close (min ${MEASUREMENT_CONSTANTS.MIN_DISTANCE}m)` 
    };
  }

  return { valid: true };
};

/**
 * Smooths measurements using exponential moving average
 * Useful for live/continuous measurements
 * 
 * @param previousValue - Previous smoothed value
 * @param newValue - New raw measurement
 * @param smoothingFactor - Weight of new value (0-1, default 0.3)
 * @returns Smoothed value
 */
export const smoothMeasurement = (
  previousValue: number,
  newValue: number,
  smoothingFactor: number = 0.3
): number => {
  return previousValue * (1 - smoothingFactor) + newValue * smoothingFactor;
};

/**
 * Converts distance from different units to meters
 */
export const convertToMeters = {
  fromFeet: (feet: number) => feet * 0.3048,
  fromInches: (inches: number) => inches * 0.0254,
  fromCentimeters: (cm: number) => cm / 100,
  fromKilometers: (km: number) => km * 1000,
};

/**
 * Converts distance from meters to different units
 */
export const convertFromMeters = {
  toFeet: (meters: number) => meters / 0.3048,
  toInches: (meters: number) => meters / 0.0254,
  toCentimeters: (meters: number) => meters * 100,
  toKilometers: (meters: number) => meters / 1000,
};

/**
 * Formats a measurement for display
 * 
 * @param meters - Value in meters
 * @param unit - Target unit ('m' | 'ft' | 'cm')
 * @param decimals - Number of decimal places
 * @returns Formatted string
 */
export const formatMeasurement = (
  meters: number,
  unit: 'm' | 'ft' | 'cm' = 'm',
  decimals: number = 2
): string => {
  let value = meters;
  
  switch (unit) {
    case 'ft':
      value = convertFromMeters.toFeet(meters);
      break;
    case 'cm':
      value = convertFromMeters.toCentimeters(meters);
      break;
  }

  return `${value.toFixed(decimals)}${unit}`;
};

/**
 * Calculates the estimated error range for a measurement
 * 
 * @param measurement - Tree measurement
 * @returns { min: number, max: number } - Error bounds in meters
 */
export const calculateErrorRange = (
  measurement: TreeMeasurement
): { min: number; max: number } => {
  const errorMargin = measurement.height * MEASUREMENT_CONSTANTS.ACCURACY_MARGIN;
  const confidenceFactor = measurement.confidence;

  const adjustedError = errorMargin / confidenceFactor;

  return {
    min: Math.max(0, measurement.height - adjustedError),
    max: measurement.height + adjustedError,
  };
};
