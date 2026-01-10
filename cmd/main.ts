import express from "express";
import mailRouter from "../controllers/controller";
import { config } from "../config/config";
import cors from "cors";
import { createServiceLogger } from "../utils/logger";

const logger = createServiceLogger('mail-service-app');
const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins: string[] = (
  (config.ALLOWED_ORIGINS || config.ALLOWED_ORIGIN || '')
    .split(',')
    .map((o: string) => o.trim())
    .filter(Boolean)
);

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }
    if (allowedOrigins.length === 0) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

app.use("/mail", mailRouter);

app.listen(PORT, () => {
  logger.info('Server started', { port: PORT });
});