import { AdminRenewalReportMail } from "../../domain/mail";
import { dailyAdminReportTemplate } from "../../domain/templates";

function renderExpiringRows(items: { userName: string; planName: string; expiryDate: string }[]): string {
    return items
        .map((item, idx) => {
            const isLast = idx === items.length - 1;
            const border = isLast ? 'none' : '1px solid rgba(55,55,55,0.7)';
            return `<tr>
                <td style="padding:11px 16px 11px 0; color:#e5e7eb; font-size:14px; border-bottom:${border};">${item.userName}</td>
                <td style="padding:11px 16px 11px 0; color:#9ca3af; font-size:14px; border-bottom:${border};">${item.planName}</td>
                <td style="padding:11px 0; color:#D4A853; font-size:14px; font-weight:600; border-bottom:${border};">${item.expiryDate}</td>
            </tr>`;
        })
        .join('');
}

function renderExpiredRows(items: { userName: string; planName: string; expiryDate: string }[]): string {
    return items
        .map((item, idx) => {
            const isLast = idx === items.length - 1;
            const border = isLast ? 'none' : '1px solid rgba(55,55,55,0.7)';
            return `<tr>
                <td style="padding:11px 16px 11px 0; color:#e5e7eb; font-size:14px; border-bottom:${border};">${item.userName}</td>
                <td style="padding:11px 16px 11px 0; color:#9ca3af; font-size:14px; border-bottom:${border};">${item.planName}</td>
                <td style="padding:11px 0; color:#fca5a5; font-size:14px; font-weight:600; border-bottom:${border};">${item.expiryDate}</td>
            </tr>`;
        })
        .join('');
}

export function renderDailyAdminReportHTML(opts: AdminRenewalReportMail): string {
    let html = dailyAdminReportTemplate;

    const hasExpiring = Array.isArray(opts.expiringSoon) && opts.expiringSoon.length > 0;
    const hasRecently = Array.isArray(opts.recentlyExpired) && opts.recentlyExpired.length > 0;

    const expiringSection = hasExpiring
        ? `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <thead>
                <tr>
                  <th align="left" style="font-size:11px; font-weight:600; color:#D4A853; letter-spacing:1px; text-transform:uppercase; padding:0 16px 12px 0; border-bottom:1px solid rgba(212,168,83,0.3);">Usuario</th>
                  <th align="left" style="font-size:11px; font-weight:600; color:#D4A853; letter-spacing:1px; text-transform:uppercase; padding:0 16px 12px 0; border-bottom:1px solid rgba(212,168,83,0.3);">Plan</th>
                  <th align="left" style="font-size:11px; font-weight:600; color:#D4A853; letter-spacing:1px; text-transform:uppercase; padding:0 0 12px 0; border-bottom:1px solid rgba(212,168,83,0.3);">Vence el</th>
                </tr>
              </thead>
              <tbody>
                ${renderExpiringRows(opts.expiringSoon)}
              </tbody>
            </table>`
        : `<p style="color:#6b7280; font-size:14px; margin:0; font-style:italic;">Sin planes próximos a vencer.</p>`;

    const recentlySection = hasRecently
        ? `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <thead>
                <tr>
                  <th align="left" style="font-size:11px; font-weight:600; color:#fca5a5; letter-spacing:1px; text-transform:uppercase; padding:0 16px 12px 0; border-bottom:1px solid rgba(239,68,68,0.3);">Usuario</th>
                  <th align="left" style="font-size:11px; font-weight:600; color:#fca5a5; letter-spacing:1px; text-transform:uppercase; padding:0 16px 12px 0; border-bottom:1px solid rgba(239,68,68,0.3);">Plan</th>
                  <th align="left" style="font-size:11px; font-weight:600; color:#fca5a5; letter-spacing:1px; text-transform:uppercase; padding:0 0 12px 0; border-bottom:1px solid rgba(239,68,68,0.3);">Venció el</th>
                </tr>
              </thead>
              <tbody>
                ${renderExpiredRows(opts.recentlyExpired)}
              </tbody>
            </table>`
        : `<p style="color:#6b7280; font-size:14px; margin:0; font-style:italic;">Sin planes vencidos en los últimos 7 días.</p>`;

    html = html.replace(/\{\{gymName\}\}/g, opts.gymName || '');
    html = html.replace('{{EXPIRING_SECTION}}', expiringSection);
    html = html.replace('{{RECENTLY_SECTION}}', recentlySection);
    html = html.replace(/\{\{reportDate\}\}/g, opts.reportDate || '');
    html = html.replace(/\{\{year\}\}/g, new Date().getFullYear().toString());

    return html;
}
