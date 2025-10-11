import { AppConfig } from '../config/AppConfig';

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';
type LogModule = 'visibility' | 'playback' | 'prefetch' | 'video' | 'metrics';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 999,
};

class Logger {
  private shouldLog(level: LogLevel, module: LogModule): boolean {
    const config = AppConfig.config.logging;
    
    // Check if logging is globally enabled
    if (!config.enabled) return false;
    
    // Check if this module is enabled
    if (!config.modules[module]) return false;
    
    // Check if log level allows this message
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[config.level];
  }

  debug(module: LogModule, message: string, ...args: any[]): void {
    if (this.shouldLog('debug', module)) {
      console.log(`[${module.toUpperCase()}] ${message}`, ...args);
    }
  }

  info(module: LogModule, message: string, ...args: any[]): void {
    if (this.shouldLog('info', module)) {
      console.log(`[${module.toUpperCase()}] ${message}`, ...args);
    }
  }

  warn(module: LogModule, message: string, ...args: any[]): void {
    if (this.shouldLog('warn', module)) {
      console.warn(`[${module.toUpperCase()}] ${message}`, ...args);
    }
  }

  error(module: LogModule, message: string, ...args: any[]): void {
    if (this.shouldLog('error', module)) {
      console.error(`[${module.toUpperCase()}] ${message}`, ...args);
    }
  }
}

export const logger = new Logger();

