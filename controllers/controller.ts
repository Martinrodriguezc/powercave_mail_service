import { Router } from "express";
import { sendBulkReminderMails, sendDiscountEmail, getLastEmailByTenant, sendReminderReportEmail } from "../mail_service/service";
import { requireMailServiceAccess } from "../middleware.ts/mail";
import { AuthenticatedRequest, requireAuth } from "../middleware.ts/auth";
import { requireApiKey } from "../middleware.ts/apiKeyAuth";
import { sendDailyAdminReportMail } from "../mail_service/admin/admin_service";
import { sendDailySalesReportMail } from "../mail_service/sales/sales_service";
import { createServiceLogger } from "../utils/logger";

const router = Router();
const logger = createServiceLogger('mail-controller');

// TODO: Descomentar cuando se necesite autenticación
// router.use(requireAuth);
// router.use(requireMailServiceAccess);

router.post("/send_reminder", requireApiKey, async (req, res) => {
    // El backend enviará un array de recordatorios
    const reminders = req.body;
    const sentBy = 'backend_service';

    // Validar que sea un array
    if (!Array.isArray(reminders) || reminders.length === 0) {
        return res.status(400).json({ 
            message: "Request body must be a non-empty JSON array" 
        });
    }

    // Validar campos requeridos en cada elemento del array
    for (let i = 0; i < reminders.length; i++) {
        const reminder = reminders[i];
        if (!reminder.to || !reminder.userName || !reminder.planName || !reminder.expiryDate) {
            return res.status(400).json({ 
                message: `Missing required fields in reminder at index ${i}. Required: to, userName, planName, expiryDate` 
            });
        }
    }

    try {
        const reminderMails = reminders.map((reminder) => ({
            to: reminder.to,
            userName: reminder.userName,
            planName: reminder.planName,
            expiryDate: reminder.expiryDate,
            subject: 'Recordatorio: tu plan vence pronto | Powercave',
            ...(reminder.publicId && { publicId: reminder.publicId })
        }));

        // Procesar todos los recordatorios con throttling
        const result = await sendBulkReminderMails(reminderMails, sentBy);

        // Enviar reporte administrativo automáticamente al finalizar el procesamiento
        // Esto se ejecuta después de que el loop haya procesado al último cliente
        logger.info('Processing completed, sending administrative report', { 
            total: reminders.length,
            successful: result.successful,
            failed: result.failed.length
        });
        await sendReminderReportEmail(result.reporte_final);

        res.status(200).json({
            message: "Reminders processed successfully",
            total: reminders.length,
            successful: result.successful,
            failed: result.failed.length,
            ...(result.failed.length > 0 && { failures: result.failed })
        });
    } catch (error: any) {
        logger.error('Error sending reminders', error, { 
            totalReminders: reminders.length 
        });
        res.status(500).json({ 
            message: "Error sending reminders",
            error: error?.message 
        });
    }
});

router.post("/send_bulk_reminders", requireAuth, requireMailServiceAccess, async (req: AuthenticatedRequest, res) => {
    const { reminders } = req.body;
    const sentBy = req.user?.name || 'test-user';

    if (!Array.isArray(reminders) || reminders.length === 0) {
        return res.status(400).json({ message: "Array of reminders is required" });
    }

    try {
        const reminderMails = reminders.map((reminder) => ({
            ...reminder,
            subject: 'Recordatorio: tu plan vence pronto | Powercave',
            ...(reminder.publicId && { publicId: reminder.publicId })
        }));

        const result = await sendBulkReminderMails(reminderMails, sentBy);

        res.status(200).json({
            message: "Bulk reminders sent successfully",
            successful: result.successful,
            failed: result.failed.length,
            failures: result.failed
        });
    } catch (error) {
        res.status(500).json({ message: "Error sending bulk reminders" });
    }
});

// Endpoint sin autenticación (temporalmente comentado)
router.post("/send_discount_email", async (req, res) => {
    const { to, userName, promotionEndDate, emails } = req.body;
    
    try {
        // Si se envía un array de emails, procesar múltiples
        if (emails && Array.isArray(emails) && emails.length > 0) {
            logger.info('Processing bulk discount emails', { total: emails.length });
            
            // Procesar con delay entre envíos para evitar que el servicio agrupe emails duplicados
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
                    // Agregar identificador único al subject para evitar que se agrupen emails duplicados
                    const uniqueSubject = `🎄 Oferta Navideña Especial - Hasta 35% de Descuento | Powercave [${timestamp}-${i + 1}]`;
                    
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
                
                // Delay de 1 segundo entre envíos para evitar que el servicio agrupe emails
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
        
        // Formato individual (compatibilidad con formato anterior)
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

router.post("/send_daily_admin_report", requireApiKey, async (req, res) => {
    const mailData = req.body;
    // Para backend-to-backend, usar un identificador del servicio
    const sentBy = 'sales_registry_backend';

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
    // Para backend-to-backend, usar un identificador del servicio
    const sentBy = 'sales_registry_backend';

    try {
        await sendDailySalesReportMail(mailData, sentBy);
        res.status(200).json({ message: "Daily sales report sent successfully" });
    } catch (error: any) {
        logger.error('Error sending daily sales report', error);
        res.status(500).json({ message: "Error sending daily sales report", error: error?.message });
    }
});

router.get("/last-emails-by-tenant", requireAuth, requireMailServiceAccess, async (req: AuthenticatedRequest, res) => {
    try {
        const lastEmails = await getLastEmailByTenant();

        res.status(200).json({
            count: lastEmails.length,
            data: lastEmails
        });
    } catch (error) {
        logger.error('Error getting last emails by tenant', error);
        res.status(500).json({ message: "Error retrieving last emails by tenant" });
    }
});



export default router;