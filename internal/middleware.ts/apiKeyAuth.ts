import { Request, Response, NextFunction } from "express";
import { config } from "../../config/config";
import { createServiceLogger } from "../../utils/logger";

const logger = createServiceLogger('api-key-auth');


export const requireApiKey = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!config.MAIL_SERVICE_API_KEY) {
    logger.error('Configuration error: MAIL_SERVICE_API_KEY is not set in environment variables', undefined, {
      action: 'api_key_validation'
    });
    return res.status(500).json({ 
      message: "Server misconfiguration: API Key authentication is not properly configured" 
    });
  }

  // Obtener la API Key del header
  const apiKey = req.headers["x-api-key"] as string | undefined;

  // Verificar que el header esté presente
  if (!apiKey) {
    logger.warn('Unauthorized attempt: Missing X-API-Key header', {
      action: 'api_key_validation',
      ip: req.ip
    });
    return res.status(401).json({ 
      message: "Unauthorized: Missing X-API-Key header" 
    });
  }

  // Comparar la API Key proporcionada con la configurada
  if (apiKey !== config.MAIL_SERVICE_API_KEY) {
    logger.warn('Forbidden attempt: Invalid API Key', {
      action: 'api_key_validation',
      ip: req.ip
    });
    return res.status(403).json({ 
      message: "Forbidden: Invalid API Key" 
    });
  }

  // API Key válida, continuar
  logger.success('API Key authentication', {
    action: 'api_key_validation',
    ip: req.ip
  });
  next();
};

