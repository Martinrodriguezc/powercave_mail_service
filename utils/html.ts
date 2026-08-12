// Escapa caracteres HTML para que un valor de texto no pueda inyectar markup
// en las plantillas, que interpolan con String.replace y no con un motor de
// templating.
export function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
