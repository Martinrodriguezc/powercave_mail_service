import { prisma } from "./db";

export const getLastEmailByTenant = async () => {
    const lastEmails = await prisma.emailLog.groupBy({
        by: ['publicId'],
        _max: {
            sentAt: true,
        },
    });

    const emailDetails = await Promise.all(
        lastEmails
            .filter((group: { _max: { sentAt: Date | null } }) => group._max.sentAt !== null)
            .map(async (group: { publicId: string; _max: { sentAt: Date | null } }) => {
                const lastEmail = await prisma.emailLog.findFirst({
                    where: {
                        publicId: group.publicId,
                        sentAt: group._max.sentAt!,
                    },
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
                return lastEmail;
            })
    );

    return emailDetails
        .filter(email => email !== null)
        .sort((a, b) => new Date(b!.sentAt).getTime() - new Date(a!.sentAt).getTime());
};
