import { prisma } from "./db";

export const getLastEmailByTenant = async () => {
  const lastEmails = await prisma.emailLog.findMany({
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
