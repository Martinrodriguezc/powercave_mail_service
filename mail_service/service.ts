import transporter from "../domain/config";
import { Mail, ReminderMail } from "../domain/mail";
import { reminderTemplate } from "../domain/templates";

export async function sendMail(opts: Mail | ReminderMail): Promise<void> {
    try {
      await transporter.sendMail({
        from: `"Powercave" <${process.env.SMTP_USER}>`, 
        to: opts.to,                                  
        subject: opts.subject,                        
        text: opts.text,                              
        html: opts.html,                              
      });
    } catch (error) {
      throw error;
    }
}

export const sendReminderMail = async (opts: ReminderMail): Promise<void> => {
    try {
        let html = reminderTemplate;
        
        html = html.replace(/\{\{userName\}\}/g, opts.userName || '');
        html = html.replace(/\{\{planName\}\}/g, opts.planName || '');
        html = html.replace(/\{\{expiryDate\}\}/g, opts.expiryDate || '');
        html = html.replace(/\{\{year\}\}/g, new Date().getFullYear().toString());
        
        html = html.replace(/\{\{#if.*?\}\}[\s\S]*?\{\{\/if\}\}/g, '');
        
        await sendMail({
            to: opts.to,
            subject: opts.subject,
            html: html,
            userName: opts.userName,
            planName: opts.planName,
            expiryDate: opts.expiryDate,
        });
    } catch (error) {
        throw error;
    }
}
