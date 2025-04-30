/**
 * ICE Configuration interface
 * Compatible with both string output and object output formats
 */
export interface IceConfig {
  source?: string;
  // Allow output to be either a string or an object with a path property
  output?: string | { path: string; [key: string]: any };
  watch?: {
    paths?: string[];
    [key: string]: any;
  };
  [key: string]: any;
}
