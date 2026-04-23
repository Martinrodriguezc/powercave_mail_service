import express from "express";
import mailRouter from "../internal/controllers";
import b2bSalesOrderRouter from "../internal/b2b/salesOrder/controllers";
import { config, validateRequiredEnvVars } from "../config/config";
import cors from "cors";
import { createServiceLogger } from "../utils/logger";

validateRequiredEnvVars();

const logger = createServiceLogger("mail-service-app");
const app = express();
const PORT = config.PORT || 3000;

const allowedOrigins: string[] = (config.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o: string) => o.trim())
  .filter(Boolean);

if (allowedOrigins.length === 0) {
  if (config.isProduction) {
    logger.error(
      "ALLOWED_ORIGINS no configurado en produccion: requests cross-origin seran rechazadas",
      undefined,
      {
        action: "cors_config",
        env: config.NODE_ENV ?? "undefined",
      },
    );
  } else {
    logger.warn(
      "ALLOWED_ORIGINS no configurado: se permite cualquier origen (solo desarrollo)",
      {
        action: "cors_config",
        env: config.NODE_ENV ?? "undefined",
      },
    );
  }
}

const CORS_REJECTION_ERROR = new Error("Not allowed by CORS");

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }
    if (allowedOrigins.length === 0) {
      if (config.isProduction) {
        return callback(CORS_REJECTION_ERROR);
      }
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(CORS_REJECTION_ERROR);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "20mb" }));

app.use("/mail", mailRouter);
app.use("/mail", b2bSalesOrderRouter);

app.listen(PORT, () => {
  logger.info("Server started", { port: PORT });
});
