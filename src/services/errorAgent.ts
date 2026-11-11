import { invoke } from '@tauri-apps/api/core';
import { logger } from './logger';

interface ErrorLog {
  message: string;
  stack?: string;
  type?: 'ERROR' | 'WARN' | 'INFO' | 'CRITICAL';
  context?: Record<string, unknown>;
}

const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

class ErrorAgent {
  private static instance: ErrorAgent;
  private isInitialized = false;
  private listeners: ((log: ErrorLog) => void)[] = [];

  private constructor() {}

  public static getInstance(): ErrorAgent {
    if (!ErrorAgent.instance) {
      ErrorAgent.instance = new ErrorAgent();
    }
    return ErrorAgent.instance;
  }

  public subscribe(listener: (log: ErrorLog) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  public init() {
    if (this.isInitialized) return;

    window.onerror = (message, source, lineno, colno, error) => {
      this.log({
        message: message.toString(),
        stack: error?.stack,
        type: 'CRITICAL',
        context: { source, lineno, colno }
      });
    };

    window.onunhandledrejection = (event) => {
      this.log({
        message: event.reason?.message || 'Unhandled Promise Rejection',
        stack: event.reason?.stack,
        type: 'ERROR',
        context: { reason: event.reason }
      });
    };

    this.isInitialized = true;
  }

  public async log(error: ErrorLog) {
    this.listeners.forEach(l => l(error));

    if (import.meta.env.DEV) {
      console.groupCollapsed(`[ErrorAgent] ${error.type || 'ERROR'}: ${error.message}`);
      if (error.stack) logger.error('Error stack', { stack: error.stack });
      if (error.context) logger.debug('Error context', error.context);
      console.groupEnd();
    }

    try {
      if (isTauri) {
        await invoke('log_error', { errorData: error });
      }
    } catch (e) {
      logger.warn('Failed to send log to main process', { error: String(e) });
    }
  }

  public async getLogsPath(): Promise<string> {
    if (isTauri) {
      return await invoke<string>('get_logs_path');
    }
    return '';
  }
}

export const errorAgent = ErrorAgent.getInstance();
