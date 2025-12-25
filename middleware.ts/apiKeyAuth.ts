import { Request, Response, NextFunction } from "express";
import { config } from "../config/config";

/**
 * Middleware para autenticación mediante API Key
 * Valida el header X-API-Key contra la variable de entorno MAIL_SERVICE_API_KEY
 */
export const requireApiKey = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Verificar que la API Key esté configurada en el servidor
  if (!config.MAIL_SERVICE_API_KEY) {
    console.error("❌ Configuration error: MAIL_SERVICE_API_KEY is not set in environment variables");
    return res.status(500).json({ 
      message: "Server misconfiguration: API Key authentication is not properly configured" 
    });
  }

  // Obtener la API Key del header
  const apiKey = req.headers["x-api-key"] as string | undefined;

  // Verificar que el header esté presente
  if (!apiKey) {
    console.warn(`⚠️  Unauthorized attempt: Missing X-API-Key header from ${req.ip}`);
    return res.status(401).json({ 
      message: "Unauthorized: Missing X-API-Key header" 
    });
  }

  // Comparar la API Key proporcionada con la configurada
  if (apiKey !== config.MAIL_SERVICE_API_KEY) {
    console.warn(`⚠️  Forbidden attempt: Invalid API Key from ${req.ip}`);
    return res.status(403).json({ 
      message: "Forbidden: Invalid API Key" 
    });
  }

  // API Key válida, continuar
  console.log(`✅ API Key authentication successful from ${req.ip}`);
  next();
};

