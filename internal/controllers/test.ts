import { Router } from "express";
import { TEST_MAILS, TEST_MAIL_TYPES } from "../domain/testData";
import { AuthenticatedRequest, requireAuth } from "../middleware.ts/auth";
import { requireSuperadmin } from "../middleware.ts/mail";
import { createServiceLogger } from "../../utils/logger";
import { escapeHtml } from "../../utils/html";

const router = Router();
const logger = createServiceLogger("mail-tester");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Tope global, no por usuario: la cuota de Resend (plan free, 100 correos al
// día) también lo es. 60 deja hacer dos barridos completos de las plantillas
// y todavía sobra margen para los correos de verdad.
const SEND_LIMIT = 60;
const SEND_WINDOW_MS = 24 * 60 * 60 * 1000;
const recentSends: number[] = [];

// En memoria: se pierde al reiniciar y no se comparte entre instancias. Alcanza
// para evitar quemar la cuota; si el servicio escala, mover a la DB o a Redis.
const isOverSendLimit = (): boolean => {
  const cutoff = Date.now() - SEND_WINDOW_MS;
  while (recentSends.length > 0 && (recentSends[0] as number) < cutoff) {
    recentSends.shift();
  }
  return recentSends.length >= SEND_LIMIT;
};

router.get(
  "/test/types",
  requireAuth,
  requireSuperadmin,
  (_req: AuthenticatedRequest, res) => {
    res
      .status(200)
      .json({ count: TEST_MAIL_TYPES.length, data: TEST_MAIL_TYPES });
  },
);

router.post(
  "/test/send",
  requireAuth,
  requireSuperadmin,
  async (req: AuthenticatedRequest, res) => {
    const { type, withTestData, gymName, logoUrl } = req.body ?? {};
    // Un `to` no-string reventaría el .trim() fuera del try: el servicio no
    // registra error middleware, así que sería un 500 con stack en vez de 400.
    const rawTo =
      typeof req.body?.to === "string" ? req.body.to : (req.user?.email ?? "");
    const to = rawTo.trim();

    const testMail = Object.prototype.hasOwnProperty.call(TEST_MAILS, type)
      ? TEST_MAILS[type]
      : undefined;
    if (!testMail) {
      return res.status(400).json({ message: `Unknown mail type: ${type}` });
    }
    if (!EMAIL_REGEX.test(to)) {
      return res.status(400).json({ message: "Invalid recipient email" });
    }
    if (logoUrl && !/^https?:\/\//.test(logoUrl)) {
      return res
        .status(400)
        .json({ message: "logoUrl must be an http(s) URL" });
    }
    if (isOverSendLimit()) {
      return res.status(429).json({
        message: `Test send limit reached (${SEND_LIMIT} emails per 24h)`,
      });
    }

    recentSends.push(Date.now());

    try {
      await testMail.send({
        to,
        full: withTestData !== false,
        // Escapado acá porque las plantillas interpolan {{gymName}} sin
        // escapar: sin esto el endpoint permitiría mandar HTML arbitrario a
        // cualquier casilla, firmado con el dominio de la plataforma.
        gymName:
          typeof gymName === "string" && gymName.trim()
            ? escapeHtml(gymName.trim())
            : null,
        logoUrl: logoUrl || null,
      });
      res.status(200).json({ message: "Test email sent", type, to });
    } catch (error) {
      logger.error("Error sending test email", error, { type, to });
      res.status(500).json({ message: "Error sending test email" });
    }
  },
);

export default router;
