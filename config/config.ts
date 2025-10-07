import dotenv from 'dotenv';

dotenv.config();

export interface AppConfig {
  JWT_SECRET: string;
  ALLOWED_ORIGIN: string | undefined;
  ALLOWED_ORIGINS: string | undefined;
  PORT: string | number | undefined;
  RESEND_API_KEY: string;
}

export const config: AppConfig = {
  JWT_SECRET: process.env.JWT_SECRET || '',
  ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
  PORT: process.env.PORT,
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
};
