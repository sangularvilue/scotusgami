/**
 * "New gami" notifications via Resend (https://resend.com).
 *
 * Configured entirely through env so the rest of the app stays provider-blind:
 *   RESEND_API_KEY   required to actually send (absent → no-op)
 *   EMAIL_TO         recipient (default willgrannis@gmail.com)
 *   EMAIL_FROM       verified sender (default Resend's shared onboarding addr)
 */

export interface NewGami {
  lineupKey: string;
  /** e.g. "6–3" */
  split: string;
  caseName: string;
  oyezUrl: string;
  decided: string;
}

export interface EmailResult {
  sent: boolean;
  reason?: string;
}

const SITE = "https://scotusgami.grannis.xyz";

function renderHtml(gamis: NewGami[]): string {
  const rows = gamis
    .map(
      (g) => `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #242c38;font:600 15px/1.3 Georgia,serif;color:#ecd193;white-space:nowrap;">${g.split}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #242c38;font:400 14px/1.4 Georgia,serif;color:#e9e1cd;">
          <a href="${g.oyezUrl}" style="color:#e9e1cd;text-decoration:none;">${g.caseName}</a>
        </td>
        <td style="padding:10px 14px;border-bottom:1px solid #242c38;font:400 12px/1.3 monospace;color:#9a958a;white-space:nowrap;">${g.decided}</td>
      </tr>`
    )
    .join("");

  const lede =
    gamis.length === 1
      ? "A division of the nine that had never happened before just lit up on the board."
      : `${gamis.length} divisions of the nine that had never happened before just lit up on the board.`;

  return `
  <div style="background:#0d1015;padding:32px 0;">
    <div style="max-width:560px;margin:0 auto;background:#131820;border:1px solid #242c38;border-top:3px solid #c9a558;border-radius:8px;overflow:hidden;">
      <div style="padding:24px 28px 8px;">
        <div style="font:600 11px/1 monospace;letter-spacing:.22em;color:#c9a558;text-transform:uppercase;">new scotusgami</div>
        <h1 style="margin:8px 0 0;font:500 28px/1.1 Georgia,serif;color:#e9e1cd;">A fresh division of the nine</h1>
        <p style="margin:12px 0 0;font:400 14px/1.5 Georgia,serif;color:#9a958a;">${lede}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;margin:16px 0 8px;">${rows}</table>
      <div style="padding:8px 28px 24px;">
        <a href="${SITE}" style="display:inline-block;border:1px solid rgba(201,165,88,.6);border-radius:4px;padding:8px 16px;font:600 12px/1 monospace;color:#c9a558;text-decoration:none;">view the board →</a>
      </div>
    </div>
  </div>`;
}

export async function sendNewGamiEmail(gamis: NewGami[]): Promise<EmailResult> {
  if (gamis.length === 0) return { sent: false, reason: "nothing new" };
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, reason: "RESEND_API_KEY unset" };

  const to = process.env.EMAIL_TO || "willgrannis@gmail.com";
  const from = process.env.EMAIL_FROM || "SCOTUSgami <onboarding@resend.dev>";
  const subject =
    gamis.length === 1
      ? `New SCOTUSgami: ${gamis[0].split} — ${gamis[0].caseName}`
      : `${gamis.length} new SCOTUSgami alignments`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html: renderHtml(gamis) }),
  });

  if (!res.ok) {
    return { sent: false, reason: `resend ${res.status}: ${await res.text()}` };
  }
  return { sent: true };
}
