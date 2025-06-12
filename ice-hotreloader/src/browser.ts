// This should be the entry point for your browser bundle
import { BrowserHMR } from './browser/index.js';

// Extend window interface to avoid any types
interface WindowWithHMR extends Window {
    ICE_HOTRELOAD_CONFIG?: { port?: number; host?: string };
    IceHMR?: BrowserHMR;
}

// Initialize browser functionality - check for global config first
const globalConfig = typeof window !== 'undefined' && (window as WindowWithHMR).ICE_HOTRELOAD_CONFIG;
const hmr = new BrowserHMR(globalConfig || {});

// Expose to global scope if needed
if (typeof window !== 'undefined') {
    (window as WindowWithHMR).IceHMR = hmr;
}