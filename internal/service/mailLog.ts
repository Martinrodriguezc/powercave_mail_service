import { MailType, EmailStatus } from "@prisma/client";
import { config } from "../../config/config";
import { createServiceLogger } from "../../utils/logger";
import { prisma } from "./db";

const logger = createServiceLogger("mail-log");

const PLATFORM_TIMEZONE = "America/Santiago";

/**
 * Contexto de gimnasio de un envio. Lo arma cada controller desde el body y lo
 * arrastra hasta el punto que toca Resend. Sin `gymPublicId` el correo es de
 * plataforma: se registra igual, pero no consume ni topa cupo.
 */
export interface MailContext {
  gymPublicId: string | null;
  gymName: string | null;
  dailyLimit: number;
  /** Fecha calendario ISO (YYYY-MM-DD) en el huso del gimnasio. */
  localDay: string;
  sentBy: string;
}

export interface MailContextInput {
  gymPublicId?: unknown;
  gymName?: unknown;
  gymTimezone?: unknown;
  dailyEmailLimit?: unknown;
  sentBy?: unknown;
}

/** Fila a registrar. Un envio simple pasa una, un lote pasa una por destinatario. */
export interface MailLogRow {
  recipient: string;
  subject: string;
  mailType: MailType;
  status: EmailStatus;
  errorMessage?: string | null;
  publicId?: string | null;
  clientName?: string | null;
  providerMessageId?: string | null;
  /** Solo el app release lo usa: un lote suyo cruza varios gimnasios. */
  gymPublicId?: string | null;
  gymName?: string | null;
}

const asNonEmptyString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : null;

/**
 * Fecha calendario en el huso indicado. `en-CA` ya formatea YYYY-MM-DD, asi que
 * no hace falta una libreria de fechas: la stdlib alcanza.
 *
 * Se guarda como texto y no como Date a proposito: una columna DATE comparada
 * contra un Date de JS depende de la zona de sesion de Postgres, y un
 * off-by-one ahi corre el corte del dia sin que se note.
 */
const localDayIn = (timezone: string): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const resolveTimezone = (raw: unknown): string => {
  const candidate = asNonEmptyString(raw);
  if (!candidate) return PLATFORM_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: candidate });
    return candidate;
  } catch {
    // Un huso invalido no puede tumbar el envio: se cae al de la plataforma.
    logger.warn("Invalid gym timezone, falling back to platform default", {
      timezone: String(raw),
    });
    return PLATFORM_TIMEZONE;
  }
};

/**
 * Un tope no entero o menor a 1 se ignora: un cero por tipeo apagaria todo el
 * correo del gimnasio.
 */
const resolveDailyLimit = (raw: unknown): number =>
  typeof raw === "number" && Number.isInteger(raw) && raw > 0
    ? raw
    : config.MAIL_DAILY_LIMIT_DEFAULT;

export const resolveMailContext = (
  input: MailContextInput = {},
  defaultSentBy = "backend_service",
): MailContext => ({
  gymPublicId: asNonEmptyString(input.gymPublicId),
  gymName: asNonEmptyString(input.gymName),
  dailyLimit: resolveDailyLimit(input.dailyEmailLimit),
  localDay: localDayIn(resolveTimezone(input.gymTimezone)),
  sentBy: asNonEmptyString(input.sentBy) ?? defaultSentBy,
});

export interface QuotaResult {
  allowed: number;
  sentToday: number;
  dailyLimit: number;
}

/**
 * Cuantos de los `requested` entran en el cupo del dia. Los `failed` cuentan
 * como consumo: salieron hacia Resend. Los `blocked` no, nunca llegaron.
 *
 * ponytail: se cuenta antes de enviar, asi que dos requests simultaneos del
 * mismo gimnasio pueden pasar ambos estando al limite. El exceso posible es del
 * orden de la concurrencia. Si alguna vez importa el corte exacto, la salida es
 * un contador atomico por (gymPublicId, localDay).
 */
export const checkQuota = async (
  ctx: MailContext,
  requested: number,
  enforce = true,
): Promise<QuotaResult> => {
  if (!enforce || !ctx.gymPublicId) {
    return { allowed: requested, sentToday: 0, dailyLimit: ctx.dailyLimit };
  }

  const sentToday = await prisma.emailLog.count({
    where: {
      gymPublicId: ctx.gymPublicId,
      localDay: ctx.localDay,
      status: { in: ["sent", "failed"] },
    },
  });

  const remaining = Math.max(0, ctx.dailyLimit - sentToday);
  return {
    allowed: Math.min(requested, remaining),
    sentToday,
    dailyLimit: ctx.dailyLimit,
  };
};

/**
 * Una sola escritura, ya con el estado final. Un fallo del registro no puede
 * tumbar el envio: el correo ya salio, subcontar es mejor que perderlo.
 */
export const logMail = async (
  ctx: MailContext,
  rows: MailLogRow[],
): Promise<void> => {
  if (rows.length === 0) return;

  try {
    await prisma.emailLog.createMany({
      data: rows.map((row) => ({
        recipient: row.recipient,
        subject: row.subject,
        mail_type: row.mailType,
        status: row.status,
        errorMessage: row.errorMessage ?? null,
        publicId: row.publicId ?? null,
        clientName: row.clientName ?? null,
        providerMessageId: row.providerMessageId ?? null,
        sentBy: ctx.sentBy,
        gymPublicId: row.gymPublicId ?? ctx.gymPublicId,
        gymName: row.gymName ?? ctx.gymName,
        dailyLimit: ctx.dailyLimit,
        localDay: ctx.localDay,
      })),
    });
  } catch (error: any) {
    logger.error("Error writing mail log", error, {
      rows: rows.length,
      gymPublicId: ctx.gymPublicId,
    });
  }
};

export class DailyEmailLimitReachedError extends Error {
  readonly code = "DAILY_EMAIL_LIMIT_REACHED";

  constructor(
    public sentToday: number,
    public dailyLimit: number,
  ) {
    super(`Daily email limit reached (${sentToday}/${dailyLimit})`);
    this.name = "DailyEmailLimitReachedError";
  }
}
