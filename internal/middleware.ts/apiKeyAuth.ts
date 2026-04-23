import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
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

  // Obtener la API Key del header. Un header duplicado llega como string[];
  // lo tratamos como invalido (bad request) en vez de concatenar valores.
  const rawApiKey = req.headers["x-api-key"];
  if (Array.isArray(rawApiKey)) {
    logger.warn('Bad request: Duplicated X-API-Key header', {
      action: 'api_key_validation',
      ip: req.ip,
    });
    return res.status(400).json({
      message: "Bad Request: Duplicated X-API-Key header",
    });
  }
  const apiKey = rawApiKey;

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

  // Comparacion en tiempo constante: evita timing attacks que puedan
  // inferir la API key byte por byte midiendo la latencia de respuesta.
  const providedBuf = Buffer.from(apiKey, "utf8");
  const expectedBuf = Buffer.from(config.MAIL_SERVICE_API_KEY, "utf8");
  const lengthMatches = providedBuf.length === expectedBuf.length;
  const contentMatches =
    lengthMatches && crypto.timingSafeEqual(providedBuf, expectedBuf);

  if (!contentMatches) {
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

