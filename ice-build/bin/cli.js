#!/usr/bin/env node
import { startBuild } from '../dist/ice-build.js';

startBuild().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});