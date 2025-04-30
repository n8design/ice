/**
 * Base Builder class
 */
import { EventEmitter } from 'events';
import { IceConfig } from '../interfaces/config.js';

export class Builder extends EventEmitter {
  protected config: IceConfig;
  
  constructor(config: IceConfig) {
    super();
    this.config = config;
  }
}
