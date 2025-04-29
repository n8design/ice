import { IceConfig, HotReloadEvent, HotReloadEventType } from '../types.js';
import debounce from 'lodash.debounce';
import path from 'path';
import { Logger } from '../utils/logger.js';

const logger = new Logger('HotReload');

export class HotReloadManager {
  private config: IceConfig;
  private hotreloader: any | null = null;
  private debouncedSendEvent: (event: HotReloadEvent) => void;

  constructor(config: IceConfig) {
    this.config = config;
    
    // Create debounced function for sending reload events
    const debounceTime = config.hotreload?.debounceTime || 300;
    this.debouncedSendEvent = debounce(
      (event: HotReloadEvent) => this.sendEvent(event), 
      debounceTime
    );
  }

  async initialize(): Promise<void> {
    try {
      // Import the ice-hotreloader
      const { HotReloadServer } = await import('@n8d/ice-hotreloader');
      
      if (!HotReloadServer) {
        logger.error('HotReloadServer not found in ice-hotreloader');
        throw new Error('Missing HotReloadServer export from ice-hotreloader');
      }
      
      const port = this.config.hotreload?.port || 3001;
      this.hotreloader = new HotReloadServer(port);
      
      logger.info(`Initialized hot reloader on port ${port}`);
    } catch (error: any) {
      logger.error(`Failed to initialize hot reloader: ${error.message}`);
      logger.warn('Hot reload functionality will be disabled');
    }
  }

  sendReloadEvent(event: HotReloadEvent): void {
    this.debouncedSendEvent(event);
  }

  private sendEvent(event: HotReloadEvent): void {
    if (!this.hotreloader) {
      logger.warn('Hot reloader not initialized, skipping reload event');
      return;
    }
    
    logger.info(`Sending ${event.type} event for ${path.basename(event.path)}`);
    
    try {
      // Use notifyClients method as per HotReloadServer implementation
      this.hotreloader.notifyClients(
        event.type === HotReloadEventType.CSS_UPDATE ? 'css' : 'full',
        event.path
      );
    } catch (error: any) {
      logger.error(`Failed to send reload event: ${error.message}`);
    }
  }

  disconnect(): void {
    // No explicit disconnect method in HotReloadServer
    this.hotreloader = null;
    logger.info('Hot reloader reference cleared');
  }
}
