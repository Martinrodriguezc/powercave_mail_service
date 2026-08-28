import { Prisma } from "@prisma/client";
import { prisma } from "./db";

export interface TenantScope {
  role: "SUPERADMIN" | "MANAGER" | "STAFF";
  gymPublicId: string | null;
}

// El filtro anterior usaba `sentBy startsWith "cron_<gymName>"`, que no tiene
// ancla de cierre: un gimnasio cuyo nombre es prefijo de otro veia los correos
// del otro. Ahora `mail_logs` tiene `gymPublicId` indexado y el JWT lo trae,
// asi que el scope es igualdad exacta sobre el identificador, no sobre el
// nombre. Las filas anteriores a esa columna quedan con `gymPublicId` nulo y
// por lo tanto fuera del alcance de un MANAGER, que es el lado seguro.
const buildTenantWhere = (
  scope: TenantScope,
): Prisma.EmailLogWhereInput | undefined => {
  if (scope.role === "SUPERADMIN") {
    return undefined;
  }
  if (!scope.gymPublicId) {
    return { id: -1 };
  }
  return { gymPublicId: scope.gymPublicId };
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
