import fs from 'fs';
import { Logger } from '../../utils/logger.js';
import { ConfigManager } from '../../config/index.js';

const logger = new Logger('CheckDirs');

export function checkDirectories(): boolean {
  logger.info('Checking source directories...');
  // Always use default config (or refactor to async loader if needed)
  const configManager = new ConfigManager();
  const config = configManager.getConfig();
  
  let allExist = true;
  
  // Get base directory from input.path
  const baseDir = config.input.path || 'source';
  logger.info(`Base input directory: ${baseDir}`);
  
  if (!fs.existsSync(baseDir)) {
    logger.error(`Base input directory '${baseDir}' does not exist!`);
    allExist = false;
  }
  
  // Check SCSS paths
  for (const pattern of config.input.scss) {
    // Extract directory part without glob pattern
    const dirPart = pattern.replace(/\/\*\*\/\*\.scss|\*\*\/\*\.scss|\*\.scss/g, '');
    
    logger.info(`Checking SCSS directory: ${dirPart}`);
    if (!fs.existsSync(dirPart)) {
      logger.error(`SCSS source directory '${dirPart}' does not exist!`);
      allExist = false;
    }
  }
  
  // Check TS paths
  for (const pattern of config.input.ts) {
    // Extract directory part without glob pattern
    const dirPart = pattern.replace(/\/\*\*\/\*\.ts|\*\*\/\*\.ts|\*\.ts/g, '');
    
    logger.info(`Checking TS directory: ${dirPart}`);
    if (!fs.existsSync(dirPart)) {
      logger.error(`TS source directory '${dirPart}' does not exist!`);
      allExist = false;
    }
  }
  
  if (allExist) {
    logger.success('All configured source directories exist!');
  } else {
    logger.error('Some source directories are missing. Please create them or check your configuration.');
  }
  
  return allExist;
}
