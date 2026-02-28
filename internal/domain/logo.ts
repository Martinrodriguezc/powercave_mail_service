export function getLogoCid(gymName?: string | null): string {
    if (!gymName || typeof gymName !== 'string') return 'gym_logo';
    const safe = gymName.trim().replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'gym';
    const cid = `${safe}_logo`;
    return cid.length <= 128 ? cid : 'gym_logo';
}

export function getLogoImgHtml(logoUrl: string | null | undefined, gymName?: string | null): string {
    if (!logoUrl || typeof logoUrl !== 'string' || logoUrl.trim() === '') return '';
    const cid = getLogoCid(gymName);
    return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:0 auto 24px auto;">
        <tr>
          <td align="center" style="padding:4px;border-radius:50%;background:linear-gradient(135deg,#D4A853,#b8922e);line-height:0;">
            <!--[if mso]><table cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:4px"><![endif]-->
            <img src="cid:${cid}" alt="Logo" width="100" height="100" border="0" style="display:block;width:100px;height:100px;border-radius:50%;object-fit:cover;outline:none;text-decoration:none;" />
            <!--[if mso]></td></tr></table><![endif]-->
          </td>
        </tr>
      </table>`;
}