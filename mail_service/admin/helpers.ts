import { AdminRenewalReportMail } from "../../domain/mail";
import { dailyAdminReportTemplate } from "../../domain/templates";

export function renderRows(items: { userName: string; planName: string; expiryDate: string }[]): string {
    if (!items || items.length === 0) return "";
    return items
        .map((item) => `
                      <tr>
                        <td>${item.userName}</td>
                        <td>${item.planName}</td>
                        <td>${item.expiryDate}</td>
                      </tr>`)
        .join("");
}

export function renderDailyAdminReportHTML(opts: AdminRenewalReportMail): string {
    let html = dailyAdminReportTemplate;

    const hasExpiring = Array.isArray(opts.expiringSoon) && opts.expiringSoon.length > 0;
    const hasRecently = Array.isArray(opts.recentlyExpired) && opts.recentlyExpired.length > 0;

    const expiringSection = hasExpiring
        ? `
                <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse; margin-top:8px;">
                  <thead>
                    <tr style="background-color:#f0f0f0;">
                      <th align="left" style="font-weight:bold;">Usuario</th>
                      <th align="left" style="font-weight:bold;">Plan</th>
                      <th align="left" style="font-weight:bold;">Vence el</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${renderRows(opts.expiringSoon)}
                  </tbody>
                </table>
            `
        : `<p style="color:#555;">Ningún usuario tiene planes próximos a vencer.</p>`;

    const recentlySection = hasRecently
        ? `
                <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse; margin-top:8px;">
                  <thead>
                    <tr style="background-color:#f0f0f0;">
                      <th align="left" style="font-weight:bold;">Usuario</th>
                      <th align="left" style="font-weight:bold;">Plan</th>
                      <th align="left" style="font-weight:bold;">Venció el</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${renderRows(opts.recentlyExpired)}
                  </tbody>
                </table>
            `
        : `<p style=\"color:#555;\">No hay planes vencidos en los últimos 3 días.</p>`;

    html = html.replace(/\{\{#if expiringSoon\.length\}[\s\S]*?\{\{\/if\}\}/g, expiringSection);
    html = html.replace(/\{\{#if recentlyExpired\.length\}[\s\S]*?\{\{\/if\}\}/g, recentlySection);

    html = html.replace(/\{\{#each[^}]*\}\}[\s\S]*?\{\{\/each\}\}/g, "");

    html = html.replace(/\{\{reportDate\}\}/g, opts.reportDate || "");
    html = html.replace(/\{\{year\}\}/g, new Date().getFullYear().toString());

    return html;
}