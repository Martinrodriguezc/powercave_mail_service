import { DailySalesReportMail } from "../../domain/mail";
import { dailySalesReportTemplate } from "../../domain/templates";

/**
 * Formatea un número como moneda chilena ($XXX.XXX)
 */
function formatCurrency(amount: number): string {
    return `$${amount.toLocaleString('es-CL')}`;
}

/**
 * Renderiza una fila de tabla de venta
 */
function renderSaleRow(clientName: string, itemName: string, amount: number, time: string): string {
    return `
                      <tr>
                        <td style="padding:10px 8px; border-bottom:1px solid #e0e0e0;">${clientName}</td>
                        <td style="padding:10px 8px; border-bottom:1px solid #e0e0e0;">${itemName}</td>
                        <td style="padding:10px 8px; border-bottom:1px solid #e0e0e0; text-align:right; font-weight:600; color:#333333;">${formatCurrency(amount)}</td>
                        <td style="padding:10px 8px; border-bottom:1px solid #e0e0e0; text-align:center; color:#666666;">${time}</td>
                      </tr>`;
}

/**
 * Renderiza la sección de ventas de planes
 */
function renderPlanSalesSection(planSales: DailySalesReportMail['planSales']): string {
    if (!planSales.sales || planSales.sales.length === 0) {
        return `<p style="color:#666666; font-size:14px; margin:0; padding:16px; background-color:#f9f9f9; border-radius:4px;">No se registraron ventas de planes hoy.</p>`;
    }

    const rows = planSales.sales
        .map(sale => renderSaleRow(sale.clientName, sale.planName, sale.amount, sale.time))
        .join('');

    return `
                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin-top:8px; border:1px solid #e0e0e0;">
                  <thead>
                    <tr style="background-color:#f0f0f0;">
                      <th align="left" style="padding:12px 8px; font-weight:bold; color:#333333; font-size:13px; border-bottom:2px solid #d0d0d0;">Cliente</th>
                      <th align="left" style="padding:12px 8px; font-weight:bold; color:#333333; font-size:13px; border-bottom:2px solid #d0d0d0;">Plan</th>
                      <th align="right" style="padding:12px 8px; font-weight:bold; color:#333333; font-size:13px; border-bottom:2px solid #d0d0d0;">Monto</th>
                      <th align="center" style="padding:12px 8px; font-weight:bold; color:#333333; font-size:13px; border-bottom:2px solid #d0d0d0;">Hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rows}
                  </tbody>
                  <tfoot>
                    <tr style="background-color:#f9f9f9; border-top:2px solid #d0d0d0;">
                      <td colspan="2" align="right" style="padding:12px 8px; font-weight:bold; color:#333333; font-size:15px;">Total:</td>
                      <td align="right" style="padding:12px 8px; font-weight:bold; color:#333333; font-size:15px;">${formatCurrency(planSales.totalAmount)}</td>
                      <td style="padding:12px 8px;"></td>
                    </tr>
                  </tfoot>
                </table>
            `;
}

/**
 * Renderiza la sección de ventas de alimentos
 */
function renderFoodSalesSection(foodSales: DailySalesReportMail['foodSales']): string {
    if (!foodSales.sales || foodSales.sales.length === 0) {
        return `<p style="color:#666666; font-size:14px; margin:0; padding:16px; background-color:#f9f9f9; border-radius:4px;">No se registraron ventas de alimentos hoy.</p>`;
    }

    const rows = foodSales.sales
        .map(sale => renderSaleRow(sale.clientName, sale.foodName, sale.amount, sale.time))
        .join('');

    return `
                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin-top:8px; border:1px solid #e0e0e0;">
                  <thead>
                    <tr style="background-color:#f0f0f0;">
                      <th align="left" style="padding:12px 8px; font-weight:bold; color:#333333; font-size:13px; border-bottom:2px solid #d0d0d0;">Cliente</th>
                      <th align="left" style="padding:12px 8px; font-weight:bold; color:#333333; font-size:13px; border-bottom:2px solid #d0d0d0;">Producto</th>
                      <th align="right" style="padding:12px 8px; font-weight:bold; color:#333333; font-size:13px; border-bottom:2px solid #d0d0d0;">Monto</th>
                      <th align="center" style="padding:12px 8px; font-weight:bold; color:#333333; font-size:13px; border-bottom:2px solid #d0d0d0;">Hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rows}
                  </tbody>
                  <tfoot>
                    <tr style="background-color:#f9f9f9; border-top:2px solid #d0d0d0;">
                      <td colspan="2" align="right" style="padding:12px 8px; font-weight:bold; color:#333333; font-size:15px;">Total:</td>
                      <td align="right" style="padding:12px 8px; font-weight:bold; color:#333333; font-size:15px;">${formatCurrency(foodSales.totalAmount)}</td>
                      <td style="padding:12px 8px;"></td>
                    </tr>
                  </tfoot>
                </table>
            `;
}

/**
 * Renderiza la sección de ventas de productos/merchandise
 */
function renderMerchandiseSalesSection(merchandiseSales: DailySalesReportMail['merchandiseSales']): string {
    if (!merchandiseSales.sales || merchandiseSales.sales.length === 0) {
        return `<p style="color:#666666; font-size:14px; margin:0; padding:16px; background-color:#f9f9f9; border-radius:4px;">No se registraron ventas de productos hoy.</p>`;
    }

    const rows = merchandiseSales.sales
        .map(sale => renderSaleRow(sale.clientName, sale.productName, sale.amount, sale.time))
        .join('');

    return `
                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin-top:8px; border:1px solid #e0e0e0;">
                  <thead>
                    <tr style="background-color:#f0f0f0;">
                      <th align="left" style="padding:12px 8px; font-weight:bold; color:#333333; font-size:13px; border-bottom:2px solid #d0d0d0;">Cliente</th>
                      <th align="left" style="padding:12px 8px; font-weight:bold; color:#333333; font-size:13px; border-bottom:2px solid #d0d0d0;">Producto</th>
                      <th align="right" style="padding:12px 8px; font-weight:bold; color:#333333; font-size:13px; border-bottom:2px solid #d0d0d0;">Monto</th>
                      <th align="center" style="padding:12px 8px; font-weight:bold; color:#333333; font-size:13px; border-bottom:2px solid #d0d0d0;">Hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rows}
                  </tbody>
                  <tfoot>
                    <tr style="background-color:#f9f9f9; border-top:2px solid #d0d0d0;">
                      <td colspan="2" align="right" style="padding:12px 8px; font-weight:bold; color:#333333; font-size:15px;">Total:</td>
                      <td align="right" style="padding:12px 8px; font-weight:bold; color:#333333; font-size:15px;">${formatCurrency(merchandiseSales.totalAmount)}</td>
                      <td style="padding:12px 8px;"></td>
                    </tr>
                  </tfoot>
                </table>
            `;
}

/**
 * Renderiza el HTML completo del reporte de ventas diarias
 */
export function renderDailySalesReportHTML(opts: DailySalesReportMail): string {
    let html = dailySalesReportTemplate;

    // Reemplazar secciones
    html = html.replace('{{planSalesSection}}', renderPlanSalesSection(opts.planSales));
    html = html.replace('{{foodSalesSection}}', renderFoodSalesSection(opts.foodSales));
    html = html.replace('{{merchandiseSalesSection}}', renderMerchandiseSalesSection(opts.merchandiseSales));

    // Reemplazar valores simples
    html = html.replace('{{reportDate}}', opts.reportDate || '');
    html = html.replace('{{totalRevenue}}', formatCurrency(opts.totalRevenue));
    html = html.replace('{{year}}', new Date().getFullYear().toString());

    return html;
}

