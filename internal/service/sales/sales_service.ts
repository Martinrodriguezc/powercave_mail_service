import { DailySalesReportMail } from "../../domain/mail";
import { renderDailySalesReportHTML } from "./helpers";
import { sendMail } from "..";
import type { MailContext } from "../mailLog";

export const sendDailySalesReportMail = async (opts: DailySalesReportMail, ctx: MailContext): Promise<void> => {
    if (!opts?.to) {
        throw new Error('Destination email (to) is required');
    }
    if (!opts?.subject) {
        throw new Error('Subject is required');
    }
    if (!opts?.reportDate) {
        throw new Error('Report date is required');
    }
    if (typeof opts.totalRevenue !== 'number') {
        throw new Error('Total revenue must be a number');
    }

    const html = renderDailySalesReportHTML(opts);

    await sendMail(
        {
            to: opts.to,
            subject: opts.subject,
            html,
            logoUrl: opts.logoUrl ?? undefined,
            gymName: opts.gymName ?? undefined,
        },
        { log: { context: ctx, mailType: "daily_sales_report" } },
    );
};

