import fs from "fs";
import path from "path";
import {
  sendBulkReminderMails,
  sendReminderReportEmail,
} from "../service/reminders";
import {
  sendClientAppInvitationEmail,
  sendClientAppInvitationsBulk,
  sendClientPasswordResetEmail,
  sendPasswordResetEmail,
  sendPlatformUserCredentialsEmail,
} from "../service/credentials";
import {
  sendTrainerEmailVerificationEmail,
  sendTrainerAccountExistsEmail,
  sendTrainerInvitationEmail,
} from "../service/trainerAccount";
import {
  sendManagerWelcomeEmail,
  sendStaffWelcomeEmail,
} from "../service/welcome";
import { sendPaymentLinkEmail } from "../service/paymentLink";
import { sendLowStockAlertEmail } from "../service/lowStockAlert";
import { sendCampaignEmail } from "../service/campaign";
import { sendDailyAdminReportMail } from "../service/admin/admin_service";
import { sendDailySalesReportMail } from "../service/sales/sales_service";
import { sendSalesOrderFactoryMail } from "../b2b/salesOrder/service/salesOrderFactory";

// Envío de prueba de cualquier plantilla desde el panel de superadmin.
// `full` decide si el correo lleva datos generados o va en blanco: en blanco
// se ve el estado vacío real de cada plantilla, que es justo lo que se compara.

export interface TestMailContext {
  to: string;
  full: boolean;
  // Branding de un gimnasio real, para ver el correo tal como le llegaría.
  // Independiente de `full`: elegir gimnasio no rellena el contenido.
  gymName: string | null;
  logoUrl: string | null;
}

export interface TestMail {
  label: string;
  send: (ctx: TestMailContext) => Promise<unknown>;
}

const SENT_BY = "mail_tester";
const GYM = "Gimnasio de Prueba";
const LINK = "https://app.dashcore.cl";

const gym = ({ full, gymName }: TestMailContext) =>
  gymName ?? (full ? GYM : "");
const logo = ({ logoUrl }: TestMailContext) => logoUrl;
const link = (full: boolean) => (full ? LINK : "");
const subject = (text: string) => `[TEST] ${text}`;

// Los envíos masivos resuelven con un resumen en vez de lanzar: sin esto el
// tester reportaría "enviado" aunque el correo no haya salido.
const requireSent = async <T>(
  result: Promise<T>,
  sent: (value: T) => number,
): Promise<T> => {
  const value = await result;
  if (sent(value) === 0) {
    throw new Error("El envío de prueba no salió");
  }
  return value;
};

// Perezoso a propósito: es un fixture solo del tester, pero este módulo lo
// importa cmd/main.ts. Leerlo al arranque haría que el servicio entero no
// levante si el PDF no llega al deploy, y con él caerían todos los correos.
let testPdfBase64: string | null = null;
const getTestPdfBase64 = (): string => {
  testPdfBase64 ??= fs
    .readFileSync(path.join(__dirname, "../../assets/test-sales-order.pdf"))
    .toString("base64");
  return testPdfBase64;
};

export const TEST_MAILS: Record<string, TestMail> = {
  reminder: {
    label: "Recordatorio de vencimiento de plan",
    send: (ctx) =>
      requireSent(
        sendBulkReminderMails(
          [
            {
              to: ctx.to,
              subject: subject(
                `Recordatorio: tu plan vence pronto | ${gym(ctx)}`,
              ),
              gymName: gym(ctx),
              logoUrl: logo(ctx),
              userName: ctx.full ? "Camila Rojas" : "",
              planName: ctx.full ? "Plan Mensual Full" : "",
              expiryDate: ctx.full ? "20-08-2026" : "",
            },
          ],
          SENT_BY,
        ),
        (result) => result.successful,
      ),
  },

  reminder_report: {
    label: "Reporte administrativo de recordatorios",
    send: (ctx) =>
      requireSent(
        sendReminderReportEmail(
          ctx.full
            ? [
                {
                  publicId: "cli-0001",
                  email: "camila.rojas@example.com",
                  status: "success",
                  error: null,
                  reason: null,
                },
                {
                  publicId: "cli-0002",
                  email: "diego.munoz@example.com",
                  status: "skipped",
                  error: null,
                  reason: "Ya se envió un correo en las últimas 48 horas",
                },
                {
                  publicId: "cli-0003",
                  email: "sin-correo@example.com",
                  status: "failed",
                  error: "Invalid recipient",
                  reason: "Invalid recipient",
                },
              ]
            : [],
          [ctx.to],
          gym(ctx),
          logo(ctx),
        ),
        (result) => result.sent,
      ),
  },

  daily_admin_report: {
    label: "Reporte diario de renovaciones (admin)",
    send: (ctx) =>
      sendDailyAdminReportMail(
        {
          to: ctx.to,
          subject: subject("Reporte diario de renovaciones"),
          gymName: gym(ctx),
          logoUrl: logo(ctx),
          reportDate: ctx.full ? "12 de agosto de 2026" : "",
          expiringSoon: ctx.full
            ? [
                {
                  userName: "Camila Rojas",
                  planName: "Plan Mensual Full",
                  expiryDate: "20-08-2026",
                },
                {
                  userName: "Diego Muñoz",
                  planName: "Plan Trimestral",
                  expiryDate: "22-08-2026",
                },
              ]
            : [],
          recentlyExpired: ctx.full
            ? [
                {
                  userName: "Valentina Soto",
                  planName: "Plan Mensual",
                  expiryDate: "05-08-2026",
                },
              ]
            : [],
        },
        SENT_BY,
      ),
  },

  daily_sales_report: {
    label: "Reporte diario de ventas",
    send: (ctx) =>
      sendDailySalesReportMail(
        {
          to: ctx.to,
          subject: subject("Reporte diario de ventas"),
          gymName: gym(ctx),
          logoUrl: logo(ctx),
          reportDate: ctx.full ? "12 de agosto de 2026" : "-",
          totalRevenue: ctx.full ? 187900 : 0,
          planSales: {
            sales: ctx.full
              ? [
                  {
                    clientName: "Camila Rojas",
                    planName: "Plan Mensual Full",
                    amount: 45000,
                    time: "09:41",
                  },
                  {
                    clientName: "Diego Muñoz",
                    planName: "Plan Trimestral",
                    amount: 120000,
                    time: "18:05",
                  },
                ]
              : [],
            totalAmount: ctx.full ? 165000 : 0,
          },
          foodSales: {
            sales: ctx.full
              ? [
                  {
                    clientName: "Valentina Soto",
                    foodName: "Barra proteica",
                    amount: 2900,
                    time: "12:30",
                  },
                ]
              : [],
            totalAmount: ctx.full ? 2900 : 0,
          },
          merchandiseSales: {
            sales: ctx.full
              ? [
                  {
                    clientName: "Matías Pérez",
                    productName: "Polera DashCore",
                    amount: 20000,
                    time: "19:40",
                  },
                ]
              : [],
            totalAmount: ctx.full ? 20000 : 0,
          },
        },
        SENT_BY,
      ),
  },

  campaign_email: {
    label: "Campaña / promoción",
    send: (ctx) =>
      sendCampaignEmail({
        to: ctx.to,
        subject: subject("Campaña de prueba"),
        gymName: gym(ctx),
        logoUrl: logo(ctx),
        html: ctx.full
          ? `<div style="font-family:'Segoe UI',Arial,sans-serif;background:#0f0f0f;color:#d1d5db;padding:32px;">
               <h1 style="color:#f5b305;margin:0 0 16px;">30% de descuento</h1>
               <p style="margin:0;">Renueva tu plan antes del 31 de agosto y obtén 30% en tu próxima mensualidad.</p>
             </div>`
          : "",
      }),
  },

  trainer_email_verification: {
    label: "Verificar correo (entrenador)",
    send: (ctx) =>
      sendTrainerEmailVerificationEmail({
        to: ctx.to,
        subject: subject("Verifica tu correo"),
        userName: "Ana",
        verificationLink: link(ctx.full),
      }),
  },

  trainer_invitation: {
    label: "Invitación a un gimnasio (entrenador)",
    send: (ctx) =>
      sendTrainerInvitationEmail({
        to: ctx.to,
        subject: subject("Te invitaron a su equipo"),
        gymName: gym(ctx),
        loginLink: link(ctx.full),
      }),
  },

  trainer_account_exists: {
    label: "Ya tienes una cuenta (entrenador)",
    send: (ctx) =>
      sendTrainerAccountExistsEmail({
        to: ctx.to,
        subject: subject("Ya tienes una cuenta"),
        loginLink: link(ctx.full),
      }),
  },

  password_reset: {
    label: "Restablecer contraseña (staff / plataforma)",
    send: (ctx) =>
      sendPasswordResetEmail({
        to: ctx.to,
        subject: subject("Restablece tu contraseña"),
        gymName: gym(ctx),
        logoUrl: logo(ctx),
        resetLink: link(ctx.full),
      }),
  },

  platform_user_credentials: {
    label: "Credenciales de cuenta nueva",
    send: (ctx) =>
      sendPlatformUserCredentialsEmail({
        to: ctx.to,
        subject: subject("Credenciales de tu cuenta"),
        gymName: gym(ctx) || null,
        logoUrl: logo(ctx),
        temporaryPassword: ctx.full ? "Temp-2026-Ax9" : "",
        resetPasswordLink: link(ctx.full),
      }),
  },

  client_app_invitation: {
    label: "Invitación a la app de clientes",
    send: (ctx) =>
      sendClientAppInvitationEmail({
        to: ctx.to,
        subject: subject("Bienvenido a la app"),
        gymName: gym(ctx),
        logoUrl: logo(ctx),
        gymSlug: ctx.full ? "gimnasio-de-prueba" : "",
        tempPassword: ctx.full ? "Temp-2026-Ax9" : "",
        appStoreLink: link(ctx.full),
        googlePlayLink: link(ctx.full),
      }),
  },

  client_app_invitations_bulk: {
    label: "Invitación a la app — envío masivo",
    send: (ctx) =>
      requireSent(
        sendClientAppInvitationsBulk([
          {
            to: ctx.to,
            gymName: gym(ctx),
            logoUrl: logo(ctx),
            gymSlug: ctx.full ? "gimnasio-de-prueba" : "",
            tempPassword: ctx.full ? "Temp-2026-Ax9" : "",
            appStoreLink: link(ctx.full),
            googlePlayLink: link(ctx.full),
          },
        ]),
        (result) => result.summary.sent,
      ),
  },

  client_password_reset: {
    label: "Código de verificación (app de clientes)",
    send: (ctx) =>
      sendClientPasswordResetEmail({
        to: ctx.to,
        subject: subject("Código de verificación"),
        gymName: gym(ctx),
        logoUrl: logo(ctx),
        otp: ctx.full ? "482913" : "",
      }),
  },

  manager_welcome: {
    label: "Bienvenida a manager",
    send: (ctx) =>
      sendManagerWelcomeEmail({
        to: ctx.to,
        subject: subject("Bienvenido a Dashcore"),
        gymName: gym(ctx),
        logoUrl: logo(ctx),
        userName: ctx.full ? "Camila Rojas" : "",
        serviceStartDate: ctx.full ? "12 de agosto de 2026" : "",
        freeMonthEndsAt: ctx.full ? "12 de septiembre de 2026" : "",
        loginLink: link(ctx.full),
      }),
  },

  staff_welcome: {
    label: "Bienvenida a staff",
    send: (ctx) =>
      sendStaffWelcomeEmail({
        to: ctx.to,
        subject: subject("Bienvenido al equipo"),
        gymName: gym(ctx),
        logoUrl: logo(ctx),
        userName: ctx.full ? "Diego Muñoz" : "",
        loginLink: link(ctx.full),
      }),
  },

  payment_link: {
    label: "Link de pago",
    send: (ctx) =>
      sendPaymentLinkEmail({
        to: ctx.to,
        subject: subject("Link de pago"),
        gymName: gym(ctx),
        logoUrl: logo(ctx),
        clientName: ctx.full ? "Camila Rojas" : "",
        paymentUrl: link(ctx.full),
        amount: ctx.full ? "$45.000 CLP" : "",
        description: ctx.full ? "Plan Mensual Full — agosto 2026" : "",
        providerName: ctx.full ? "Mercado Pago" : "",
        providerLogoUrl: "",
        isRecurring: false,
      }),
  },

  low_stock_alert: {
    label: "Alerta de stock bajo",
    send: (ctx) =>
      sendLowStockAlertEmail({
        to: [ctx.to],
        subject: subject("Alerta de stock bajo"),
        gymName: gym(ctx),
        logoUrl: logo(ctx),
        generatedAt: ctx.full ? "12-08-2026 09:00" : "",
        materialItems: ctx.full
          ? [
              {
                kind: "material",
                name: "Proteína whey",
                currentStock: 2,
                minStockAlert: 10,
                unit: "kg",
              },
            ]
          : [],
        inventoryItems: ctx.full
          ? [
              {
                kind: "inventory",
                name: "Barra proteica chocolate",
                currentStock: 4,
                minStockAlert: 24,
                unit: "un",
              },
            ]
          : [],
        hasMaterials: ctx.full,
        hasInventory: ctx.full,
      }),
  },

  sales_order_to_factory: {
    label: "Orden de venta a fábrica (B2B, con PDF)",
    send: (ctx) =>
      sendSalesOrderFactoryMail({
        to: ctx.to,
        gymName: gym(ctx) || null,
        gymLegalName:
          ctx.gymName ?? (ctx.full ? "Gimnasio de Prueba SpA" : null),
        gymRut: ctx.full ? "76.543.210-K" : null,
        logoUrl: logo(ctx),
        orderNumber: ctx.full ? 1042 : 0,
        purchaseOrderNumber: ctx.full ? "4500123" : null,
        createdAtISO: ctx.full ? "2026-08-12T12:00:00.000Z" : "",
        clientBusinessName: ctx.full ? "Distribuidora Andes Ltda." : "",
        clientRut: ctx.full ? "77.111.222-3" : null,
        notes: ctx.full ? "Entregar en bodega, horario 09:00 a 13:00." : null,
        lines: ctx.full
          ? [
              {
                productName: "Barra proteica chocolate",
                description: "Caja de 24 unidades",
                quantity: 10,
                quantityUnit: "BOX",
                unitPrice: "18.990",
                lineTotal: "189.900",
              },
              {
                productName: "Proteína whey",
                description: null,
                quantity: 25,
                quantityUnit: "KG",
                unitPrice: "12.500",
                lineTotal: "312.500",
              },
            ]
          : [],
        subtotal: ctx.full ? "502.400" : "0",
        taxAmount: ctx.full ? "95.456" : "0",
        taxPercent: 19,
        total: ctx.full ? "597.856" : "0",
        attachment: {
          filename: "nota-de-venta-1042.pdf",
          contentBase64: getTestPdfBase64(),
          mimeType: "application/pdf",
        },
      }),
  },
};

export const TEST_MAIL_TYPES = Object.entries(TEST_MAILS).map(
  ([id, { label }]) => ({ id, label }),
);
