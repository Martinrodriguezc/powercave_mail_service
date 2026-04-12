export interface SalesOrderFactoryLine {
  productName: string;
  description: string | null;
  quantity: number;
  quantityUnit: "UNIT" | "KG" | "BOX";
  unitPrice: string;
  lineTotal: string;
}

export interface SalesOrderFactoryAttachment {
  filename: string;
  contentBase64: string;
  mimeType: "application/pdf";
}

export interface SalesOrderFactoryMail {
  to: string;
  gymName: string | null;
  gymLegalName: string | null;
  gymRut: string | null;
  logoUrl: string | null;
  orderNumber: number;
  purchaseOrderNumber: string | null;
  createdAtISO: string;
  clientBusinessName: string;
  clientRut: string | null;
  notes: string | null;
  lines: SalesOrderFactoryLine[];
  subtotal: string;
  taxAmount: string;
  taxPercent: number;
  total: string;
  attachment: SalesOrderFactoryAttachment;
}
