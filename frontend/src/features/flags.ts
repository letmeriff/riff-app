/**
 * Feature Flags
 *
 * This module provides a centralized location for feature flags.
 * It retrieves values from environment variables, allowing features
 * to be toggled via configuration.
 */

/**
 * Canvas-related feature flags
 */
export const features = {
  canvas: {
    /**
     * Whether to use the refactored canvas implementation
     */
    get refactored() {
      return process.env.REACT_APP_CANVAS_REFACTORED === 'true';
    },

    /**
     * Whether to enable canvas performance monitoring
     */
    get performanceMonitoring() {
      return process.env.REACT_APP_CANVAS_PERFORMANCE === 'true';
    },

    /**
     * Whether to enable canvas node virtualization
     */
    get virtualization() {
      return process.env.REACT_APP_CANVAS_VIRTUALIZATION === 'true';
    },
  },

  /**
   * Convenient method to check if a flag is enabled
   * @param path Path to the flag in dot notation (e.g., 'canvas.refactored')
   * @returns Boolean indicating if the flag is enabled
   */
  isEnabled(path: string): boolean {
    const parts = path.split('.');
    let current: Record<string, unknown> = features;

    for (const part of parts) {
      if (current[part] === undefined) {
        return false;
      }
      current = current[part] as Record<string, unknown>;
    }

    return !!current;
  },
};
