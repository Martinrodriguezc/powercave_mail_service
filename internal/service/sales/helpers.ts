import { DailySalesReportMail } from "../../domain/mail";
import { getLogoImgHtml } from "../../domain/logo";
import { dailySalesReportTemplate } from "../../domain/templates";

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString("es-CL")}`;
}

function renderSaleRow(
  clientName: string,
  itemName: string,
  amount: number,
  time: string,
): string {
  return `
                      <tr>
                        <td style="padding:10px 8px; border-bottom:1px solid #1e1e1e; color:#d1d5db; background-color:#0f0f0f;">${clientName}</td>
                        <td style="padding:10px 8px; border-bottom:1px solid #1e1e1e; color:#d1d5db; background-color:#0f0f0f;">${itemName}</td>
                        <td style="padding:10px 8px; border-bottom:1px solid #1e1e1e; text-align:right; font-weight:600; color:#ffffff; background-color:#0f0f0f;">${formatCurrency(amount)}</td>
                        <td style="padding:10px 8px; border-bottom:1px solid #1e1e1e; text-align:center; color:#6b7280; background-color:#0f0f0f;">${time}</td>
                      </tr>`;
}

interface SalesSectionConfig {
  sales: {
    clientName: string;
    amount: number;
    time: string;
    [key: string]: any;
  }[];
  totalAmount: number;
  columnHeader: string;
  itemNameKey: string;
  emptyMessage: string;
}

function renderSalesSection(config: SalesSectionConfig): string {
  if (!config.sales || config.sales.length === 0) {
    return `<p style="color:#6b7280; font-size:14px; margin:0; padding:16px; background-color:#1c1c1c; border-radius:4px;">${config.emptyMessage}</p>`;
  }

  const rows = config.sales
    .map((sale) =>
      renderSaleRow(
        sale.clientName,
        sale[config.itemNameKey],
        sale.amount,
        sale.time,
      ),
    )
    .join("");

  return `
                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin-top:8px; border:1px solid #2a2a2a;">
                  <thead>
                    <tr style="background-color:#131313;">
                      <th align="left" style="padding:12px 8px; font-weight:bold; color:#D4A853; font-size:13px; border-bottom:2px solid #2a2a2a;">Cliente</th>
                      <th align="left" style="padding:12px 8px; font-weight:bold; color:#D4A853; font-size:13px; border-bottom:2px solid #2a2a2a;">${config.columnHeader}</th>
                      <th align="right" style="padding:12px 8px; font-weight:bold; color:#D4A853; font-size:13px; border-bottom:2px solid #2a2a2a;">Monto</th>
                      <th align="center" style="padding:12px 8px; font-weight:bold; color:#D4A853; font-size:13px; border-bottom:2px solid #2a2a2a;">Hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rows}
                  </tbody>
                  <tfoot>
                    <tr style="background-color:#131313; border-top:2px solid #2a2a2a;">
                      <td colspan="2" align="right" style="padding:12px 8px; font-weight:bold; color:#D4A853; font-size:15px;">Total:</td>
                      <td align="right" style="padding:12px 8px; font-weight:bold; color:#ffffff; font-size:15px;">${formatCurrency(config.totalAmount)}</td>
                      <td style="padding:12px 8px;"></td>
                    </tr>
                  </tfoot>
                </table>
            `;
}

export function renderDailySalesReportHTML(opts: DailySalesReportMail): string {
  let html = dailySalesReportTemplate;

  html = html.replace(
    "{{planSalesSection}}",
    renderSalesSection({
      sales: opts.planSales.sales,
      totalAmount: opts.planSales.totalAmount,
      columnHeader: "Plan",
      itemNameKey: "planName",
      emptyMessage: "No se registraron ventas de planes hoy.",
    }),
  );
  html = html.replace(
    "{{foodSalesSection}}",
    renderSalesSection({
      sales: opts.foodSales.sales,
      totalAmount: opts.foodSales.totalAmount,
      columnHeader: "Producto",
      itemNameKey: "foodName",
      emptyMessage: "No se registraron ventas de alimentos hoy.",
    }),
  );
  html = html.replace(
    "{{merchandiseSalesSection}}",
    renderSalesSection({
      sales: opts.merchandiseSales.sales,
      totalAmount: opts.merchandiseSales.totalAmount,
      columnHeader: "Producto",
      itemNameKey: "productName",
      emptyMessage: "No se registraron ventas de productos hoy.",
    }),
  );

  html = html.replace(
    /\{\{logoImg\}\}/g,
    getLogoImgHtml(opts.logoUrl, opts.gymName),
  );
  html = html.replace("{{reportDate}}", opts.reportDate || "");
  html = html.replace(/\{\{gymName\}\}/g, opts.gymName || "");
  html = html.replace("{{totalRevenue}}", formatCurrency(opts.totalRevenue));
  html = html.replace("{{year}}", new Date().getFullYear().toString());

  return html;
}
