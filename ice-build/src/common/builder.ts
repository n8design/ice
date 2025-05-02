/**
 * Base Builder class
 */
import { EventEmitter } from 'events';
import { IceConfig } from '../types.js'; // Updated import path

export class Builder extends EventEmitter {
  protected config: IceConfig;
  
  constructor(config: IceConfig) {
    super();
    this.config = config;
  }
}
