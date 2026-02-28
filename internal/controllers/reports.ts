import { Router } from "express";
import { sendDailyAdminReportMail } from "../service/admin/admin_service";
import { sendDailySalesReportMail } from "../service/sales/sales_service";
import { requireApiKey } from "../middleware.ts/apiKeyAuth";
import { createServiceLogger } from "../../utils/logger";

const router = Router();
const logger = createServiceLogger('reports');

router.post("/send_daily_admin_report", requireApiKey, async (req, res) => {
    const mailData = req.body;
    const sentBy = mailData?.sentBy ?? 'daily_admin_report_backend';

    try {
        await sendDailyAdminReportMail(mailData, sentBy);
        res.status(200).json({ message: "Daily admin report sent successfully" });
    } catch (error: any) {
        logger.error('Error sending daily admin report', error);
        res.status(500).json({ message: "Error sending daily admin report", error: error?.message });
    }
});

router.post("/send_daily_sales_report", requireApiKey, async (req, res) => {
    const mailData = req.body;
    const sentBy = mailData?.sentBy ?? 'sales_registry_backend';

    try {
        await sendDailySalesReportMail(mailData, sentBy);
        res.status(200).json({ message: "Daily sales report sent successfully" });
    } catch (error: any) {
        logger.error('Error sending daily sales report', error);
        res.status(500).json({ message: "Error sending daily sales report", error: error?.message });
    }
});

export default router;
