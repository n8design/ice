// This should be the entry point for your browser bundle
import { BrowserHMR } from './browser/index.js';

// Initialize browser functionality
const hmr = new BrowserHMR();

// Expose to global scope if needed
(window as unknown as { IceHMR: BrowserHMR }).IceHMR = hmr;

// No unused variables or types - just the core functionality