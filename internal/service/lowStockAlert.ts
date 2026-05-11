import {
  LowStockAlertItem,
  LowStockAlertMail,
} from "../domain/mail";
import { getLogoImgHtml } from "../domain/logo";
import { lowStockAlertTemplate } from "../domain/templates";
import { sendMail } from "./mail";

// Escapa caracteres HTML para evitar inyeccion via nombres provenientes
// del backend (los items son input semi-estructurado del usuario).
function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Renderiza filas de la tabla por item. Los colores se derivan del color
// de acento de la seccion (gold/red) para mantener coherencia visual.
function renderItemRows(
  items: LowStockAlertItem[],
  accentColor: string,
): string {
  return items
    .map((item, idx) => {
      const isLast = idx === items.length - 1;
      const border = isLast ? "none" : "1px solid rgba(55,55,55,0.7)";
      const unit = item.unit ? ` ${escapeHtml(item.unit)}` : "";
      const name = escapeHtml(item.name);
      return `<tr>
                <td style="padding:11px 16px 11px 0; color:#e5e7eb; font-size:14px; border-bottom:${border};">${name}</td>
                <td style="padding:11px 16px 11px 0; color:${accentColor}; font-size:14px; font-weight:700; border-bottom:${border};">${item.currentStock}${unit}</td>
                <td style="padding:11px 0; color:#9ca3af; font-size:14px; border-bottom:${border};">${item.minStockAlert}${unit}</td>
            </tr>`;
    })
    .join("");
}

function renderSection(
  title: string,
  items: LowStockAlertItem[],
  accentColor: string,
  bgColor: string,
  borderColor: string,
): string {
  const tableHtml = `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <thead>
                <tr>
                  <th align="left" style="font-size:11px; font-weight:600; color:${accentColor}; letter-spacing:1px; text-transform:uppercase; padding:0 16px 12px 0; border-bottom:1px solid ${borderColor};">Item</th>
                  <th align="left" style="font-size:11px; font-weight:600; color:${accentColor}; letter-spacing:1px; text-transform:uppercase; padding:0 16px 12px 0; border-bottom:1px solid ${borderColor};">Stock actual</th>
                  <th align="left" style="font-size:11px; font-weight:600; color:${accentColor}; letter-spacing:1px; text-transform:uppercase; padding:0 0 12px 0; border-bottom:1px solid ${borderColor};">Minimo</th>
                </tr>
              </thead>
              <tbody>
                ${renderItemRows(items, accentColor)}
              </tbody>
            </table>`;

  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;">
                <tr>
                  <td style="background-color:${bgColor}; border:1px solid ${borderColor}; border-radius:8px; padding:22px 26px;">
                    <p style="margin:0 0 16px; font-size:11px; font-weight:700; color:${accentColor}; letter-spacing:2px; text-transform:uppercase;">
                      &#9679;&nbsp; ${title}
                    </p>
                    ${tableHtml}
                  </td>
                </tr>
              </table>`;
}

export function renderLowStockAlertHTML(opts: LowStockAlertMail): string {
  let html = lowStockAlertTemplate;

  // Seccion materiales (acento gold, mismo look que "expiring soon")
  const materialsSection = opts.hasMaterials
    ? renderSection(
        "Materiales con stock bajo",
        opts.materialItems,
        "#D4A853",
        "#1c1608",
        "rgba(212,168,83,0.35)",
      )
    : "";

  // Seccion inventario (acento rojo, mismo look que "recently expired")
  const inventorySection = opts.hasInventory
    ? renderSection(
        "Inventario con stock bajo",
        opts.inventoryItems,
        "#fca5a5",
        "#180a0a",
        "rgba(239,68,68,0.32)",
      )
    : "";

  html = html.replace(
    /\{\{logoImg\}\}/g,
    getLogoImgHtml(opts.logoUrl, opts.gymName),
  );
  html = html.replace(/\{\{gymName\}\}/g, escapeHtml(opts.gymName));
  html = html.replace(/\{\{generatedAt\}\}/g, escapeHtml(opts.generatedAt));
  html = html.replace("{{MATERIALS_SECTION}}", materialsSection);
  html = html.replace("{{INVENTORY_SECTION}}", inventorySection);
  html = html.replace(/\{\{year\}\}/g, new Date().getFullYear().toString());

  return html;
}

export const sendLowStockAlertEmail = async (
  opts: LowStockAlertMail,
): Promise<void> => {
  const html = renderLowStockAlertHTML(opts);

  // Resend acepta arrays como `to`, pero el helper `sendMail` del proyecto
  // recibe un string por envio. Replicamos el patron de `sendReminderReportEmail`
  // y enviamos un correo por destinatario.
  for (const recipient of opts.to) {
    await sendMail({
      to: recipient,
      subject: opts.subject,
      html,
      logoUrl: opts.logoUrl ?? undefined,
      gymName: opts.gymName,
    });
  }
};
