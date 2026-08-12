import fs from "fs";
import path from "path";

// El sufijo nombra el fondo, igual que en el frontend: `-light` es el logo
// para fondo claro (nota de venta B2B) y el sin sufijo, para fondo oscuro
// (las 12 plantillas dark). Se leen una vez al arranque, como las plantillas.
export const DASHCORE_LOGOS = [
  { cid: "dashcore_logo", file: "dashcore-logo.png" },
  { cid: "dashcore_logo_light", file: "dashcore-logo-light.png" },
].map(({ cid, file }) => ({
  cid,
  base64: fs
    .readFileSync(path.join(__dirname, "../../assets", file))
    .toString("base64"),
}));

export function getLogoCid(gymName?: string | null): string {
  if (!gymName || typeof gymName !== "string") return "gym_logo";
  const safe =
    gymName
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || "gym";
  const cid = `${safe}_logo`;
  // Un gimnasio llamado "dashcore" generaría el mismo CID que el logo de
  // DashCore y el cliente de correo mostraría una sola de las dos imágenes.
  const collides = DASHCORE_LOGOS.some((logo) => logo.cid === cid);
  return cid.length <= 128 && !collides ? cid : "gym_logo";
}

export function getLogoImgHtml(
  logoUrl: string | null | undefined,
  gymName?: string | null,
): string {
  if (!logoUrl || typeof logoUrl !== "string" || logoUrl.trim() === "")
    return "";
  const cid = getLogoCid(gymName);
  return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:0 auto 24px auto;">
        <tr>
          <td align="center" style="padding:4px;border-radius:50%;background:linear-gradient(135deg,#dd920d,#b0740a);line-height:0;">
            <!--[if mso]><table cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:4px"><![endif]-->
            <img src="cid:${cid}" alt="Logo" width="100" height="100" border="0" style="display:block;width:100px;height:100px;border-radius:50%;object-fit:cover;outline:none;text-decoration:none;" />
            <!--[if mso]></td></tr></table><![endif]-->
          </td>
        </tr>
      </table>`;
}
