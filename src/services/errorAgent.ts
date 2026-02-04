// import { ipcRenderer } from 'electron';

interface ErrorLog {
  message: string;
  stack?: string;
  type?: 'ERROR' | 'WARN' | 'INFO' | 'CRITICAL';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context?: Record<string, any>;
}

class ErrorAgent {
  private static instance: ErrorAgent;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): ErrorAgent {
    if (!ErrorAgent.instance) {
      ErrorAgent.instance = new ErrorAgent();
    }
    return ErrorAgent.instance;
  }

  public init() {
    if (this.isInitialized) return;

    // Global Error Handler
    window.onerror = (message, source, lineno, colno, error) => {
      this.log({
        message: message.toString(),
        stack: error?.stack,
        type: 'CRITICAL',
        context: { source, lineno, colno }
      });
    };

    // Unhandled Promise Rejections
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
    // Console log for dev
    if (import.meta.env.DEV) {
      // console.groupCollapsed(`[ErrorAgent] ${error.type || 'ERROR'}: ${error.message}`);
      // console.error(error.stack);
      // console.log(error.context);
      // console.groupEnd();
    }

    // Send to Main Process
    try {
      if (window.ipcRenderer) {
        await window.ipcRenderer.invoke('log-error', error);
      }
    } catch (e) {
      // console.error('[ErrorAgent] Failed to send log to main process:', e);
    }
  }

  public async getLogsPath(): Promise<string> {
    if (window.ipcRenderer) {
      return await window.ipcRenderer.invoke('get-logs-path');
    }
    return '';
  }
}

export const errorAgent = ErrorAgent.getInstance();
