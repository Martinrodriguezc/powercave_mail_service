import pino from 'pino';

// Configuración del logger - formato JSON estructurado
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Tipos para contexto de logs
interface LogContext {
  service?: string;
  action?: string;
  userId?: number;
  email?: string;
  ip?: string | undefined;
  duration?: number;
  [key: string]: unknown;
}

// Helper para crear un logger con contexto de servicio
export const createServiceLogger = (serviceName: string) => {
  const serviceLogger = logger.child({ service: serviceName });

  return {
    // Log de información general
    info: (message: string, context?: LogContext) => {
      serviceLogger.info(context || {}, message);
    },

    // Log de depuración (solo en desarrollo)
    debug: (message: string, context?: LogContext) => {
      serviceLogger.debug(context || {}, message);
    },

    // Log de advertencia
    warn: (message: string, context?: LogContext) => {
      serviceLogger.warn(context || {}, message);
    },

    // Log de error
    error: (message: string, error?: Error | unknown, context?: LogContext) => {
      const errorContext = {
        ...context,
        ...(error instanceof Error
          ? {
              errorName: error.name,
              errorMessage: error.message,
              stack: error.stack,
            }
          : { error: String(error) }),
      };
      serviceLogger.error(errorContext, message);
    },

    // Log de acción exitosa (útil para auditoría)
    success: (action: string, context?: LogContext) => {
      serviceLogger.info({ action, status: 'success', ...context }, `${action} completed successfully`);
    },

    // Log de acción fallida
    failure: (action: string, reason: string, context?: LogContext) => {
      serviceLogger.warn({ action, status: 'failure', reason, ...context }, `${action} failed: ${reason}`);
    },
  };
};

// Logger por defecto para uso general
export default logger;

