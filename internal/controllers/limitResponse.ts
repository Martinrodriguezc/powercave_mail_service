import { Response } from "express";
import { DailyEmailLimitReachedError } from "../service/mailLog";

/**
 * Traduce el tope diario a un 429. Es una condicion esperada, no una falla de
 * envio: el caller la distingue por `code` y no la trata como error de red.
 * Devuelve `true` si ya respondio.
 */
export const respondIfDailyLimitReached = (
  res: Response,
  error: unknown,
): boolean => {
  if (!(error instanceof DailyEmailLimitReachedError)) return false;

  res.status(429).json({
    message: error.message,
    code: error.code,
    sentToday: error.sentToday,
    dailyLimit: error.dailyLimit,
  });
  return true;
};
