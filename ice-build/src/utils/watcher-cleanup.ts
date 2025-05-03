import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger.js';

const execAsync = promisify(exec);
const logger = new Logger('WatcherCleanup');

/**
 * Clean up any orphaned watcher processes and files
 */
export async function cleanupWatchers(): Promise<void> {
  logger.info('Cleaning up file watchers...');
  
  try {
    // Find watch processes - command differs by platform
    const cmd = process.platform === 'win32'
      ? `tasklist /FI "IMAGENAME eq node.exe" /FO CSV | findstr "watch"`
      : `ps -ef | grep "node" | grep "watch" | grep -v grep`;
    
    try {
      const { stdout } = await execAsync(cmd);
      const lines = stdout.split('\n').filter(line => line.trim());
      
      if (lines.length > 0) {
        logger.info(`Found ${lines.length} watcher processes`);
        
        // Parse lines and extract PIDs
        for (const line of lines) {
          try {
            // Extract PID differently based on platform
            let pid: string;
            if (process.platform === 'win32') {
              // Format: "node.exe","13244","Console","1","1,952 K"
              pid = line.split(',')[1]?.replace(/"/g, '') || '';
            } else {
              // Format: user 12345 ... node watch
              pid = line.trim().split(/\s+/)[1];
            }
            
            if (pid) {
              // Kill process
              const killCmd = process.platform === 'win32' 
                ? `taskkill /F /PID ${pid}` 
                : `kill -9 ${pid}`;
              
              await execAsync(killCmd);
              logger.info(`Terminated watcher process ${pid}`);
            }
          } catch {
            // Ignore errors killing individual processes
          }
        }
      } else {
        logger.info('No watcher processes found');
      }
    } catch {
      logger.info('No active watchers found or unable to detect processes');
    }
    
    // Clean up watcher metadata files
    const filesToClean = [
      '.ice-watch-paths.txt'
    ];
    
    for (const file of filesToClean) {
      const filePath = path.join(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.info(`Removed file: ${file}`);
      }
    }
    
    logger.success('Watcher cleanup complete');
  } catch (error) {
    logger.error(`Cleanup error: ${error}`);
  }
}

// Run directly if called as a script
if (require.main === module) {
  cleanupWatchers().catch(err => console.error('Cleanup failed:', err));
}
