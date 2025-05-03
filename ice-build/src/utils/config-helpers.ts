import { IceConfig } from '../types.js';

/**
 * Safely get the output path from a config object regardless of format
 * @param config IceConfig object
 * @returns The output path as a string
 */
export function getOutputPath(config: IceConfig): string {
  if (typeof config.output === 'string') {
    return config.output;
  }
  return config.output.path;
}

/**
 * Check if the config has an input path property
 * @param config IceConfig object
 * @returns Boolean indicating if input path exists
 */
export function hasInputPath(config: IceConfig): boolean {
  return !!(config.input && 'path' in config.input && config.input.path);
}

/**
 * Get the input path if it exists
 * @param config IceConfig object
 * @returns The input path or null
 */
export function getInputPath(config: IceConfig): string | null {
  if (hasInputPath(config)) {
    return (config.input as any).path;
  }
  return null;
}
