import { sendMail } from "../../../service/mail";
import { getLogoImgHtml } from "../../../domain/logo";
import { salesOrderFactoryTemplate } from "../domain/templates";
import type {
  SalesOrderFactoryLine,
  SalesOrderFactoryMail,
} from "../domain/mail";

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatQuantity = (line: SalesOrderFactoryLine): string => {
  const decimals = line.quantityUnit === "UNIT" ? 0 : 2;
  const unitLabel =
    line.quantityUnit === "UNIT"
      ? "UD"
      : line.quantityUnit === "BOX"
        ? "CJ"
        : "KG";
  return `${line.quantity.toFixed(decimals)} ${unitLabel}`;
};

const formatCreatedAt = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const buildItemsRows = (lines: SalesOrderFactoryLine[]): string =>
  lines
    .map(
      (line) => `
        <tr>
          <td style="padding:10px 8px; border-bottom:1px solid #e4e4e7; font-weight:700; color:#111827;">${escapeHtml(line.productName)}</td>
          <td style="padding:10px 8px; border-bottom:1px solid #e4e4e7; color:#374151;">${escapeHtml(line.description ?? "-")}</td>
          <td align="right" style="padding:10px 8px; border-bottom:1px solid #e4e4e7; color:#374151; white-space:nowrap;">${escapeHtml(formatQuantity(line))}</td>
          <td align="right" style="padding:10px 8px; border-bottom:1px solid #e4e4e7; color:#374151; white-space:nowrap;">$ ${escapeHtml(line.unitPrice)}</td>
          <td align="right" style="padding:10px 8px; border-bottom:1px solid #e4e4e7; color:#111827; font-weight:700; white-space:nowrap;">$ ${escapeHtml(line.lineTotal)}</td>
        </tr>`,
    )
    .join("");

export const renderSalesOrderFactoryHTML = (
  opts: SalesOrderFactoryMail,
): string => {
  const gymLegalName = opts.gymLegalName ?? opts.gymName ?? "";
  const gymRutBlock = opts.gymRut
    ? `<p style="margin:4px 0 0; font-size:12px; color:#6b7280;">RUT: ${escapeHtml(opts.gymRut)}</p>`
    : "";
  const clientRutBlock = opts.clientRut
    ? `<p style="margin:4px 0 0; font-size:12px; color:#6b7280;"><strong style="color:#374151;">RUT:</strong> ${escapeHtml(opts.clientRut)}</p>`
    : "";
  const purchaseOrderBlock = opts.purchaseOrderNumber
    ? `<div><strong style="color:#111827;">Orden de Compra:</strong> NV ${escapeHtml(opts.purchaseOrderNumber)}</div>`
    : "";
  const notesBlock = opts.notes
    ? `<div><strong style="color:#111827;">Observaciones:</strong> ${escapeHtml(opts.notes)}</div>`
    : "";

  let html = salesOrderFactoryTemplate;
  html = html.replace(
    /\{\{logoImg\}\}/g,
    getLogoImgHtml(opts.logoUrl, opts.gymName ?? null),
  );
  html = html.replace(/\{\{gymLegalName\}\}/g, escapeHtml(gymLegalName));
  html = html.replace(/\{\{gymRutBlock\}\}/g, gymRutBlock);
  html = html.replace(/\{\{orderNumber\}\}/g, String(opts.orderNumber));
  html = html.replace(
    /\{\{createdAtFormatted\}\}/g,
    escapeHtml(formatCreatedAt(opts.createdAtISO)),
  );
  html = html.replace(
    /\{\{clientBusinessName\}\}/g,
    escapeHtml(opts.clientBusinessName),
  );
  html = html.replace(/\{\{clientRutBlock\}\}/g, clientRutBlock);
  html = html.replace(/\{\{purchaseOrderBlock\}\}/g, purchaseOrderBlock);
  html = html.replace(/\{\{notesBlock\}\}/g, notesBlock);
  html = html.replace(/\{\{itemsRows\}\}/g, buildItemsRows(opts.lines));
  html = html.replace(/\{\{subtotal\}\}/g, escapeHtml(opts.subtotal));
  html = html.replace(/\{\{taxAmount\}\}/g, escapeHtml(opts.taxAmount));
  html = html.replace(/\{\{taxPercent\}\}/g, String(opts.taxPercent));
  html = html.replace(/\{\{total\}\}/g, escapeHtml(opts.total));
  html = html.replace(
    /\{\{attachmentFilename\}\}/g,
    escapeHtml(opts.attachment.filename),
  );

  return html;
};

export const sendSalesOrderFactoryMail = async (
  opts: SalesOrderFactoryMail,
): Promise<void> => {
  const html = renderSalesOrderFactoryHTML(opts);
  const subject = `Nueva orden de venta N° ${opts.orderNumber}${opts.gymName ? ` | ${opts.gymName}` : ""}`;

  await sendMail(
    {
      to: opts.to,
      subject,
      html,
      logoUrl: opts.logoUrl ?? undefined,
      gymName: opts.gymName ?? undefined,
    },
    {
      attachments: [
        {
          filename: opts.attachment.filename,
          content: opts.attachment.contentBase64,
          contentType: opts.attachment.mimeType,
        },
      ],
    },
  );
};
