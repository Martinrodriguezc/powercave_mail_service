import { Router } from "express";
import { sendDiscountEmail } from "../service";
import { createServiceLogger } from "../../utils/logger";

const router = Router();
const logger = createServiceLogger('discount');

router.post("/send_discount_email", async (req, res) => {
    const { to, userName, promotionEndDate, emails } = req.body;

    try {
        if (emails && Array.isArray(emails) && emails.length > 0) {
            logger.info('Processing bulk discount emails', { total: emails.length });

            const results = [];
            const timestamp = Date.now();

            for (let i = 0; i < emails.length; i++) {
                const email = emails[i];
                logger.debug('Sending discount email', {
                    email: email.to,
                    userName: email.userName,
                    progress: `${i + 1}/${emails.length}`
                });

                try {
                    const uniqueSubject = `🎄 Oferta Navideña Especial - Hasta 35% de Descuento | [${timestamp}-${i + 1}]`;

                    await sendDiscountEmail({
                        to: email.to,
                        userName: email.userName,
                        subject: uniqueSubject,
                        promotionEndDate: email.promotionEndDate
                    });
                    results.push({ status: 'fulfilled' as const, value: undefined });
                    logger.success('Discount email sent', {
                        email: email.to,
                        progress: `${i + 1}/${emails.length}`
                    });
                } catch (error: any) {
                    logger.error('Error sending discount email', error, {
                        email: email.to,
                        progress: `${i + 1}/${emails.length}`
                    });
                    results.push({
                        status: 'rejected' as const,
                        reason: error
                    });
                }

                if (i < emails.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results
                .map((result, index) => ({ result, index }))
                .filter(({ result }) => result.status === 'rejected')
                .map(({ result, index }) => ({
                    email: emails[index].to,
                    userName: emails[index].userName,
                    error: result.status === 'rejected' ? (result.reason?.message ?? 'Unknown error') : ''
                }));

            logger.info('Bulk discount emails processing completed', {
                total: emails.length,
                successful,
                failed: failed.length
            });

            return res.status(200).json({
                message: "Bulk discount emails processed",
                total: emails.length,
                successful,
                failed: failed.length,
                failures: failed.length > 0 ? failed : undefined
            });
        }

        if (to && userName && promotionEndDate) {
            await sendDiscountEmail({
                to,
                userName,
                subject: '🎄 Oferta Navideña Especial - Hasta 35% de Descuento | Powercave',
                promotionEndDate
            });
            return res.status(200).json({ message: "Discount email sent successfully" });
        }

        return res.status(400).json({
            message: "Invalid request. Provide either {to, userName, promotionEndDate} or {emails: [{to, userName, promotionEndDate}, ...]}"
        });
    } catch (error: any) {
        logger.error('Error sending discount email', error);
        return res.status(500).json({ message: "Error sending discount email", error: error?.message });
    }
});

export default router;
