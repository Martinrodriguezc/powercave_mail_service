import { Router } from "express";
import { requireApiKey } from "../../../middleware.ts/apiKeyAuth";
import { createServiceLogger } from "../../../../utils/logger";
import { sendSalesOrderFactoryMail } from "../service/salesOrderFactory";
import type {
  SalesOrderFactoryLine,
  SalesOrderFactoryMail,
} from "../domain/mail";

const router = Router();
const logger = createServiceLogger("salesOrderFactory");

// 10 MB en bytes del PDF decodificado; base64 agrega ~37% de overhead.
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_BASE64_LENGTH = Math.ceil((MAX_PDF_BYTES * 4) / 3);

const VALID_QUANTITY_UNITS: ReadonlySet<SalesOrderFactoryLine["quantityUnit"]> =
  new Set(["UNIT", "KG", "BOX"]);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== "";

const validateLine = (value: unknown, index: number): SalesOrderFactoryLine => {
  if (!value || typeof value !== "object") {
    throw new Error(`lines[${index}] must be an object`);
  }
  const v = value as Record<string, unknown>;

  if (!isNonEmptyString(v["productName"])) {
    throw new Error(`lines[${index}].productName is required`);
  }
  if (typeof v["quantity"] !== "number" || !Number.isFinite(v["quantity"])) {
    throw new Error(`lines[${index}].quantity must be a finite number`);
  }
  if (
    typeof v["quantityUnit"] !== "string" ||
    !VALID_QUANTITY_UNITS.has(
      v["quantityUnit"] as SalesOrderFactoryLine["quantityUnit"],
    )
  ) {
    throw new Error(
      `lines[${index}].quantityUnit must be one of UNIT, KG, BOX`,
    );
  }
  if (!isNonEmptyString(v["unitPrice"])) {
    throw new Error(`lines[${index}].unitPrice is required`);
  }
  if (!isNonEmptyString(v["lineTotal"])) {
    throw new Error(`lines[${index}].lineTotal is required`);
  }

  return {
    productName: v["productName"] as string,
    description:
      typeof v["description"] === "string"
        ? (v["description"] as string)
        : null,
    quantity: v["quantity"] as number,
    quantityUnit: v["quantityUnit"] as SalesOrderFactoryLine["quantityUnit"],
    unitPrice: v["unitPrice"] as string,
    lineTotal: v["lineTotal"] as string,
  };
};

const validateBody = (body: unknown): SalesOrderFactoryMail => {
  if (!body || typeof body !== "object") {
    throw new Error("Body must be an object");
  }
  const b = body as Record<string, unknown>;

  if (!isNonEmptyString(b["to"])) {
    throw new Error("to is required");
  }
  if (typeof b["orderNumber"] !== "number") {
    throw new Error("orderNumber must be a number");
  }
  if (!isNonEmptyString(b["createdAtISO"])) {
    throw new Error("createdAtISO is required");
  }
  if (!isNonEmptyString(b["clientBusinessName"])) {
    throw new Error("clientBusinessName is required");
  }
  if (!Array.isArray(b["lines"]) || b["lines"].length === 0) {
    throw new Error("lines must be a non-empty array");
  }
  if (!isNonEmptyString(b["subtotal"])) {
    throw new Error("subtotal is required");
  }
  if (!isNonEmptyString(b["taxAmount"])) {
    throw new Error("taxAmount is required");
  }
  if (typeof b["taxPercent"] !== "number") {
    throw new Error("taxPercent must be a number");
  }
  if (!isNonEmptyString(b["total"])) {
    throw new Error("total is required");
  }

  const attachment = b["attachment"];
  if (!attachment || typeof attachment !== "object") {
    throw new Error("attachment is required");
  }
  const att = attachment as Record<string, unknown>;
  if (!isNonEmptyString(att["filename"])) {
    throw new Error("attachment.filename is required");
  }
  if (!isNonEmptyString(att["contentBase64"])) {
    throw new Error("attachment.contentBase64 is required");
  }
  if (att["mimeType"] !== "application/pdf") {
    throw new Error("attachment.mimeType must be 'application/pdf'");
  }

  const lines = (b["lines"] as unknown[]).map((line, i) =>
    validateLine(line, i),
  );

  return {
    to: b["to"] as string,
    gymName: typeof b["gymName"] === "string" ? (b["gymName"] as string) : null,
    gymLegalName:
      typeof b["gymLegalName"] === "string"
        ? (b["gymLegalName"] as string)
        : null,
    gymRut: typeof b["gymRut"] === "string" ? (b["gymRut"] as string) : null,
    logoUrl: typeof b["logoUrl"] === "string" ? (b["logoUrl"] as string) : null,
    orderNumber: b["orderNumber"] as number,
    purchaseOrderNumber:
      typeof b["purchaseOrderNumber"] === "string"
        ? (b["purchaseOrderNumber"] as string)
        : null,
    createdAtISO: b["createdAtISO"] as string,
    clientBusinessName: b["clientBusinessName"] as string,
    clientRut:
      typeof b["clientRut"] === "string" ? (b["clientRut"] as string) : null,
    notes: typeof b["notes"] === "string" ? (b["notes"] as string) : null,
    lines,
    subtotal: b["subtotal"] as string,
    taxAmount: b["taxAmount"] as string,
    taxPercent: b["taxPercent"] as number,
    total: b["total"] as string,
    attachment: {
      filename: att["filename"] as string,
      contentBase64: att["contentBase64"] as string,
      mimeType: "application/pdf",
    },
  };
};

router.post("/send_sales_order_to_factory", requireApiKey, async (req, res) => {
  let opts: SalesOrderFactoryMail;
  try {
    opts = validateBody(req.body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid payload";
    return res.status(400).json({ message });
  }

  if (opts.attachment.contentBase64.length > MAX_BASE64_LENGTH) {
    logger.warn("Sales order factory attachment too large", {
      email: opts.to,
      orderNumber: opts.orderNumber,
      base64Length: opts.attachment.contentBase64.length,
    });
    return res
      .status(413)
      .json({ message: "attachment exceeds maximum size of 10 MB" });
  }

  try {
    await sendSalesOrderFactoryMail(opts);
    logger.success("Sales order factory email sent", {
      email: opts.to,
      orderNumber: opts.orderNumber,
    });
    return res.status(200).json({ message: "Sales order factory email sent" });
  } catch (error: unknown) {
    logger.error("Error sending sales order factory email", error, {
      email: opts.to,
      orderNumber: opts.orderNumber,
    });
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      message: "Error sending sales order factory email",
      error: message,
    });
  }
});

export default router;
