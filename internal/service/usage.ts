import { prisma } from "./db";

const PLATFORM_TIMEZONE = "America/Santiago";

export class InvalidMonthError extends Error {
  constructor() {
    super("month must match YYYY-MM");
    this.name = "InvalidMonthError";
  }
}

export interface UsageCounters {
  sent: number;
  blocked: number;
  failed: number;
}

export interface UsageByGym extends UsageCounters {
  gymPublicId: string | null;
  gymName: string | null;
  sentToday: number;
  sentMonth: number;
  blockedMonth: number;
  dailyLimit: number | null;
}

export interface MailUsage {
  month: string;
  today: UsageCounters & { date: string };
  monthTotals: UsageCounters;
  byGym: Omit<UsageByGym, keyof UsageCounters>[];
  byType: { mailType: string; sentMonth: number }[];
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Fecha calendario de hoy en el huso de la plataforma, como YYYY-MM-DD. */
const todayInPlatformTimezone = (): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: PLATFORM_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

export const currentMonth = (): string => todayInPlatformTimezone().slice(0, 7);

/**
 * Primer dia del mes y primer dia del siguiente, como texto ISO. `localDay` se
 * guarda asi, y en ISO el orden lexicografico coincide con el cronologico.
 */
const monthBounds = (month: string): { from: string; to: string } => {
  const [year, monthNumber] = month.split("-").map(Number);
  const nextYear = monthNumber === 12 ? year! + 1 : year!;
  const nextMonth = monthNumber === 12 ? 1 : monthNumber! + 1;
  return {
    from: `${month}-01`,
    to: `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`,
  };
};

interface GymUsageRow {
  gymPublicId: string | null;
  gymName: string | null;
  sentToday: bigint;
  sentMonth: bigint;
  blockedMonth: bigint;
  dailyLimit: number | null;
}

export const getMailUsage = async (month?: string): Promise<MailUsage> => {
  const targetMonth = month ?? currentMonth();
  if (!MONTH_PATTERN.test(targetMonth)) {
    throw new InvalidMonthError();
  }

  const { from, to } = monthBounds(targetMonth);
  const today = todayInPlatformTimezone();

  const [todayGroups, monthGroups, typeGroups, gymRows] = await Promise.all([
    prisma.emailLog.groupBy({
      by: ["status"],
      where: { localDay: today },
      _count: { _all: true },
    }),
    prisma.emailLog.groupBy({
      by: ["status"],
      where: { localDay: { gte: from, lt: to } },
      _count: { _all: true },
    }),
    prisma.emailLog.groupBy({
      by: ["mail_type"],
      where: { localDay: { gte: from, lt: to }, status: "sent" },
      _count: { _all: true },
    }),
    // Los conteos por gimnasio son condicionales (hoy vs mes, enviados vs
    // bloqueados), asi que van en una sola consulta cruda en vez de cuatro
    // groupBy que despues habria que cruzar en memoria.
    prisma.$queryRaw<GymUsageRow[]>`
      SELECT
        "gymPublicId",
        MAX("gymName")                                                        AS "gymName",
        COUNT(*) FILTER (WHERE "localDay" = ${today}
                           AND status IN ('sent', 'failed'))                  AS "sentToday",
        COUNT(*) FILTER (WHERE status = 'sent')                               AS "sentMonth",
        COUNT(*) FILTER (WHERE status = 'blocked')                            AS "blockedMonth",
        (ARRAY_AGG("dailyLimit" ORDER BY "sentAt" DESC)
           FILTER (WHERE "dailyLimit" IS NOT NULL))[1]                        AS "dailyLimit"
      FROM mail_logs
      WHERE "localDay" >= ${from} AND "localDay" < ${to}
      GROUP BY "gymPublicId"
      ORDER BY COUNT(*) FILTER (WHERE status = 'sent') DESC
    `,
  ]);

  const counters = (
    groups: { status: string; _count: { _all: number } | unknown }[],
  ): UsageCounters => {
    const countOf = (status: string) => {
      const group = groups.find((g) => g.status === status);
      return (group?._count as { _all?: number } | undefined)?._all ?? 0;
    };
    return {
      sent: countOf("sent"),
      blocked: countOf("blocked"),
      failed: countOf("failed"),
    };
  };

  return {
    month: targetMonth,
    today: { date: today, ...counters(todayGroups) },
    monthTotals: counters(monthGroups),
    byGym: gymRows.map((row) => ({
      gymPublicId: row.gymPublicId,
      gymName: row.gymName,
      sentToday: Number(row.sentToday),
      sentMonth: Number(row.sentMonth),
      blockedMonth: Number(row.blockedMonth),
      dailyLimit: row.dailyLimit,
    })),
    byType: typeGroups
      .map((group) => ({
        mailType: group.mail_type,
        sentMonth: group._count._all,
      }))
      .sort((a, b) => b.sentMonth - a.sentMonth),
  };
};
