import dotenv from "dotenv";

dotenv.config();

export const NODE_ENVS = {
  PRODUCTION: "production",
  STAGING: "staging",
  DEVELOPMENT: "development",
  TEST: "test",
} as const;

export type NodeEnv = (typeof NODE_ENVS)[keyof typeof NODE_ENVS];

// Envs que se consideran "production-like": aplican politicas estrictas
// (CORS fail-closed, logs de error, etc.). Si NODE_ENV no esta seteado o
// no coincide con dev/test, se trata como prod por defecto (fail-closed).
const DEV_LIKE_ENVS: readonly string[] = [
  NODE_ENVS.DEVELOPMENT,
  NODE_ENVS.TEST,
];

export interface AppConfig {
  JWT_SECRET: string;
  ALLOWED_ORIGINS: string | undefined;
  PORT: string | number | undefined;
  RESEND_API_KEY: string;
  SENDER_EMAIL: string;
  MAIL_SERVICE_API_KEY: string;
  MAIL_DAILY_LIMIT_DEFAULT: number;
  NODE_ENV: string | undefined;
  isProduction: boolean;
}

const REQUIRED_ENV_VARS = [
  "JWT_SECRET",
  "RESEND_API_KEY",
  "SENDER_EMAIL",
  "MAIL_SERVICE_API_KEY",
] as const;

const currentNodeEnv = process.env.NODE_ENV;

// Tope diario de correos por gimnasio. Es un guardarrail contra abuso, no una
// palanca comercial: el default es holgado para la operacion normal de un gym.
const DEFAULT_MAIL_DAILY_LIMIT = 1000;

const parsedDailyLimit = Number(process.env.MAIL_DAILY_LIMIT_DEFAULT);

export const config: AppConfig = {
  JWT_SECRET: process.env.JWT_SECRET || "",
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN,
  PORT: process.env.PORT,
  RESEND_API_KEY: process.env.RESEND_API_KEY || "",
  SENDER_EMAIL: process.env.SENDER_EMAIL || "",
  MAIL_SERVICE_API_KEY: process.env.MAIL_SERVICE_API_KEY || "",
  MAIL_DAILY_LIMIT_DEFAULT:
    Number.isInteger(parsedDailyLimit) && parsedDailyLimit > 0
      ? parsedDailyLimit
      : DEFAULT_MAIL_DAILY_LIMIT,
  NODE_ENV: currentNodeEnv,
  isProduction:
    currentNodeEnv === undefined ||
    !DEV_LIKE_ENVS.includes(currentNodeEnv),
};

export function validateRequiredEnvVars(): void {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
    process.exit(1);
  }
}
