import { registerPlugin } from '@capacitor/core';

export interface ARMeasurementPlugin {
  /**
   * Opens the native AR view (ARKit on iOS, ARCore on Android) to measure distance.
   * Resolves with the distance in meters.
   */
  measureDistance(): Promise<{ distance: number }>;
}

const ARMeasurement = registerPlugin<ARMeasurementPlugin>('ARMeasurement');

export default ARMeasurement;
