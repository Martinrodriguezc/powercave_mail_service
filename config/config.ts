import dotenv from "dotenv";

dotenv.config();

export interface AppConfig {
  JWT_SECRET: string;
  ALLOWED_ORIGINS: string | undefined;
  PORT: string | number | undefined;
  RESEND_API_KEY: string;
  SENDER_EMAIL: string;
  MAIL_SERVICE_API_KEY: string;
}

const REQUIRED_ENV_VARS = [
  "JWT_SECRET",
  "RESEND_API_KEY",
  "SENDER_EMAIL",
  "MAIL_SERVICE_API_KEY",
] as const;

export const config: AppConfig = {
  JWT_SECRET: process.env.JWT_SECRET || "",
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN,
  PORT: process.env.PORT,
  RESEND_API_KEY: process.env.RESEND_API_KEY || "",
  SENDER_EMAIL: process.env.SENDER_EMAIL || "",
  MAIL_SERVICE_API_KEY: process.env.MAIL_SERVICE_API_KEY || "",
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
