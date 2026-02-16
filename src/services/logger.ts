type LogContext = Record<string, unknown> | undefined;

const formatContext = (context: LogContext) => (context ? JSON.stringify(context) : '');

export const logger = {
  debug(message: string, context?: LogContext) {
    if (import.meta.env.DEV) {
      console.debug(`[Influcine] ${message}`, formatContext(context));
    }
  },
  info(message: string, context?: LogContext) {
    console.info(`[Influcine] ${message}`, formatContext(context));
  },
  warn(message: string, context?: LogContext) {
    console.warn(`[Influcine] ${message}`, formatContext(context));
  },
  error(message: string, context?: LogContext) {
    console.error(`[Influcine] ${message}`, formatContext(context));
  },
};
