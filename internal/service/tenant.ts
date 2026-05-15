import { Prisma } from "@prisma/client";
import { prisma } from "./db";

export interface TenantScope {
  role: "SUPERADMIN" | "MANAGER" | "STAFF";
  gymName: string;
}

// Filtro temporal de tenant-leakage: hoy `EmailLog` no tiene columna `gymPublicId`,
// y `sentBy` viene del backend con formato `cron_<gymName>` (ver
// backend/src/services/cron/cronTasks.ts). Anclamos con `startsWith` para evitar
// que un MANAGER vea emails de otros gyms.
// El fix definitivo (columna `gymPublicId` indexada) llega con el port a Go.
const buildTenantWhere = (
  scope: TenantScope,
): Prisma.EmailLogWhereInput | undefined => {
  if (scope.role === "SUPERADMIN") {
    return undefined;
  }
  if (!scope.gymName) {
    return { id: -1 };
  }
  return { sentBy: { startsWith: `cron_${scope.gymName}` } };
};

export const getLastEmailByTenant = async (scope: TenantScope) => {
  const where = buildTenantWhere(scope);

  const lastEmails = await prisma.emailLog.findMany({
    ...(where && { where }),
    orderBy: { sentAt: "desc" },
    distinct: ["publicId"],
    select: {
      id: true,
      publicId: true,
      clientName: true,
      recipient: true,
      subject: true,
      mail_type: true,
      status: true,
      sentAt: true,
      errorMessage: true,
      sentBy: true,
    },
  });

  return lastEmails;
};
