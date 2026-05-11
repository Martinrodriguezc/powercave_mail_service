import { Router } from "express";
import { sendLowStockAlertEmail } from "../service";
import { requireApiKey } from "../middleware.ts/apiKeyAuth";
import { createServiceLogger } from "../../utils/logger";
import {
  LowStockAlertItem,
  LowStockItemKind,
} from "../domain/mail";

const router = Router();
const logger = createServiceLogger("low-stock-alert");

const ALLOWED_KINDS: ReadonlyArray<LowStockItemKind> = ["material", "inventory"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ValidationResult {
  ok: boolean;
  status?: number;
  body?: { message: string; missing?: string[] };
  data?: {
    to: string[];
    subject: string | undefined;
    gymName: string;
    logoUrl: string | undefined;
    items: LowStockAlertItem[];
  };
}

// Valida el payload completo segun el contrato fijo acordado con el backend.
// Devuelve estructura unica para evitar lanzar excepciones por errores de
// validacion (que no deberian convertirse en 500).
function validatePayload(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") {
    return {
      ok: false,
      status: 400,
      body: { message: "Request body must be a JSON object" },
    };
  }

  const b = body as Record<string, unknown>;

  const missing: string[] = [];
  if (!Array.isArray(b.to) || b.to.length === 0) missing.push("to");
  if (typeof b.gymName !== "string" || b.gymName.trim() === "")
    missing.push("gymName");
  if (!Array.isArray(b.items) || b.items.length === 0) missing.push("items");

  if (missing.length > 0) {
    return {
      ok: false,
      status: 400,
      body: { message: "Missing required fields", missing },
    };
  }

  const to = b.to as unknown[];
  for (let i = 0; i < to.length; i++) {
    const recipient = to[i];
    if (typeof recipient !== "string" || !EMAIL_REGEX.test(recipient)) {
      return {
        ok: false,
        status: 400,
        body: { message: `Invalid email at to[${i}]` },
      };
    }
  }

  if (b.subject !== undefined && typeof b.subject !== "string") {
    return {
      ok: false,
      status: 400,
      body: { message: "subject must be a string when provided" },
    };
  }

  if (b.logoUrl !== undefined && b.logoUrl !== null) {
    if (typeof b.logoUrl !== "string" || !b.logoUrl.startsWith("https://")) {
      return {
        ok: false,
        status: 400,
        body: { message: "logoUrl must be an https URL when provided" },
      };
    }
  }

  const rawItems = b.items as unknown[];
  const items: LowStockAlertItem[] = [];
  for (let i = 0; i < rawItems.length; i++) {
    const it = rawItems[i];
    if (!it || typeof it !== "object") {
      return {
        ok: false,
        status: 400,
        body: { message: `items[${i}] must be an object` },
      };
    }
    const item = it as Record<string, unknown>;

    if (
      typeof item.kind !== "string" ||
      !ALLOWED_KINDS.includes(item.kind as LowStockItemKind)
    ) {
      return {
        ok: false,
        status: 400,
        body: {
          message: `items[${i}].kind must be one of: ${ALLOWED_KINDS.join(", ")}`,
        },
      };
    }
    if (typeof item.name !== "string" || item.name.trim() === "") {
      return {
        ok: false,
        status: 400,
        body: { message: `items[${i}].name is required` },
      };
    }
    if (
      typeof item.currentStock !== "number" ||
      !Number.isFinite(item.currentStock) ||
      item.currentStock < 0
    ) {
      return {
        ok: false,
        status: 400,
        body: {
          message: `items[${i}].currentStock must be a finite number >= 0`,
        },
      };
    }
    if (
      typeof item.minStockAlert !== "number" ||
      !Number.isFinite(item.minStockAlert) ||
      item.minStockAlert <= 0
    ) {
      return {
        ok: false,
        status: 400,
        body: {
          message: `items[${i}].minStockAlert must be a finite number > 0`,
        },
      };
    }
    if (item.unit !== undefined && typeof item.unit !== "string") {
      return {
        ok: false,
        status: 400,
        body: { message: `items[${i}].unit must be a string when provided` },
      };
    }

    items.push({
      kind: item.kind as LowStockItemKind,
      name: item.name,
      currentStock: item.currentStock,
      minStockAlert: item.minStockAlert,
      ...(typeof item.unit === "string" && item.unit.trim() !== ""
        ? { unit: item.unit }
        : {}),
    });
  }

  return {
    ok: true,
    data: {
      to: to as string[],
      subject: typeof b.subject === "string" ? b.subject : undefined,
      gymName: (b.gymName as string).trim(),
      logoUrl: typeof b.logoUrl === "string" ? b.logoUrl : undefined,
      items,
    },
  };
}

router.post("/send_low_stock_alert", requireApiKey, async (req, res) => {
  const validation = validatePayload(req.body);
  if (!validation.ok || !validation.data) {
    return res.status(validation.status ?? 400).json(validation.body);
  }

  const { to, subject, gymName, logoUrl, items } = validation.data;

  // Particionamos por kind antes del render para que el helper reciba los
  // arrays ya separados. El backend manda items mezclados.
  const materialItems = items.filter((it) => it.kind === "material");
  const inventoryItems = items.filter((it) => it.kind === "inventory");

  // generatedAt se computa en el controller (no llega del backend), usando
  // el mismo locale/timezone que el resto del servicio.
  const generatedAt = new Date().toLocaleString("es-CL", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const finalSubject =
    subject && subject.trim() !== ""
      ? subject
      : `Alerta de stock bajo - ${gymName}`;

  try {
    await sendLowStockAlertEmail({
      to,
      subject: finalSubject,
      gymName,
      logoUrl: logoUrl ?? null,
      generatedAt,
      materialItems,
      inventoryItems,
      hasMaterials: materialItems.length > 0,
      hasInventory: inventoryItems.length > 0,
    });

    logger.success("Low stock alert email sent", {
      recipients: to.length,
      materials: materialItems.length,
      inventory: inventoryItems.length,
      gymName,
    });
    res
      .status(200)
      .json({ message: "Low stock alert email sent successfully" });
  } catch (error: any) {
    logger.error("Error sending low stock alert email", error, { gymName });
    res.status(500).json({
      message: "Error sending low stock alert email",
      error: error?.message,
    });
  }
});

export default router;
