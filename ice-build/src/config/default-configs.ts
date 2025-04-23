import autoprefixer from 'autoprefixer';

export const DEFAULT_CONFIG = {
  outputDir: 'public',
  postcssPlugins: [autoprefixer],
  port: 3001
};

export const DEFAULT_TS_CONFIG = {
  compilerOptions: {
    target: "es2020",
    module: "es2020",
    moduleResolution: "node",
    esModuleInterop: true,
    sourceMap: true,
    declaration: false,
    strict: true
  }
};