#!/usr/bin/env node
import { spawnSync } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const buildScript = resolve(__dirname, '../build.ts');

const args = process.argv.slice(2);
const result = spawnSync('tsx', [buildScript, ...args], { stdio: 'inherit' });
process.exit(result.status ?? 0);