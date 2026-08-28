import { Router } from "express";
import { requireApiKey } from "../middleware.ts/apiKeyAuth";
import { resolveMailContext } from "../service/mailLog";
import { createServiceLogger } from "../../utils/logger";
import {
  composeAppReleaseHtml,
  sendAppReleaseBatch,
  MAX_RECIPIENTS_PER_BATCH,
} from "../service/appRelease";
import { AppReleaseRecipient } from "../domain/mail";

const router = Router();
const logger = createServiceLogger("app-release");

const MAX_VERSION_LENGTH = 20;
const MAX_TITLE_LENGTH = 120;
const MAX_NOTES = 10;
const MAX_NOTE_LENGTH = 200;

interface ContentValidation {
  error?: string;
  version: string;
  title: string;
  notes: string[];
}

function validateContent(body: any): ContentValidation {
  const version = typeof body?.version === "string" ? body.version.trim() : "";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const notes: string[] = Array.isArray(body?.notes)
    ? body.notes.filter((n: unknown) => typeof n === "string" && n.trim())
    : [];

  let error: string | undefined;
  if (!version || !title || notes.length === 0) {
    error = "Faltan campos obligatorios: version, title, notes";
  } else if (version.length > MAX_VERSION_LENGTH) {
    error = `version supera los ${MAX_VERSION_LENGTH} caracteres`;
  } else if (title.length > MAX_TITLE_LENGTH) {
    error = `title supera los ${MAX_TITLE_LENGTH} caracteres`;
  } else if (notes.length > MAX_NOTES) {
    error = `notes supera los ${MAX_NOTES} elementos`;
  } else if (notes.some((n) => n.length > MAX_NOTE_LENGTH)) {
    error = `cada nota debe tener maximo ${MAX_NOTE_LENGTH} caracteres`;
  }

  return { error, version, title, notes: notes.map((n) => n.trim()) };
}

function pickContent(body: any, validated: ContentValidation) {
  return {
    version: validated.version,
    title: validated.title,
    notes: validated.notes,
    appLogoUrl: body?.appLogoUrl ?? null,
    appStoreLink: body?.appStoreLink ?? null,
    googlePlayLink: body?.googlePlayLink ?? null,
    appStoreBadgeUrl: body?.appStoreBadgeUrl ?? null,
    googlePlayBadgeUrl: body?.googlePlayBadgeUrl ?? null,
  };
}

router.post("/send_app_release", requireApiKey, async (req, res) => {
  const validated = validateContent(req.body);
  if (validated.error) {
    return res.status(400).json({ message: validated.error });
  }

  // No se descarta ningun elemento: el caller lee `results` por posicion, asi
  // que un destinatario invalido conserva su lugar y vuelve como `failed`.
  const recipients: AppReleaseRecipient[] = Array.isArray(req.body?.recipients)
    ? req.body.recipients.map((r: any) => ({
        email: typeof r?.email === "string" ? r.email.trim() : "",
        name: typeof r?.name === "string" ? r.name : null,
        gymPublicId: typeof r?.gymPublicId === "string" ? r.gymPublicId : null,
        gymName: typeof r?.gymName === "string" ? r.gymName : null,
      }))
    : [];

  if (recipients.length === 0) {
    return res.status(400).json({ message: "recipients no puede estar vacio" });
  }
  if (recipients.length > MAX_RECIPIENTS_PER_BATCH) {
    return res.status(400).json({
      message: `recipients supera los ${MAX_RECIPIENTS_PER_BATCH} elementos`,
    });
  }

  const { subject, sentBy, announcementPublicId } = req.body;
  if (!subject || !announcementPublicId) {
    return res.status(400).json({
      message: "Faltan campos obligatorios: subject, announcementPublicId",
    });
  }

  logger.info("Enviando lote de anuncio de version", {
    version: validated.version,
    size: recipients.length,
  });

  // El anuncio lo inicia el superadmin y cruza varios gimnasios: se registra
  // atribuido a cada uno, pero no consume su cupo diario.
  const results = await sendAppReleaseBatch(
    {
      ...pickContent(req.body, validated),
      subject,
      recipients,
      sentBy: sentBy ?? "system",
      announcementPublicId,
    },
    resolveMailContext({ sentBy: sentBy ?? "system" }),
  );

  return res.status(200).json({ results });
});

router.post("/preview_app_release", requireApiKey, async (req, res) => {
  const validated = validateContent(req.body);
  if (validated.error) {
    return res.status(400).json({ message: validated.error });
  }

  const html = composeAppReleaseHtml(
    pickContent(req.body, validated),
    typeof req.body?.name === "string" ? req.body.name : null,
  );

  return res.status(200).json({ html });
});

export default router;
