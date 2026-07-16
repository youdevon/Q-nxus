export type EmailTemplateVariables = Record<
  string,
  string | number | boolean | null | undefined
>

function escapedHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

export function renderTemplate(
  template: string,
  variables: EmailTemplateVariables,
  escapeValues = false,
): string {
  return template.replace(
    /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g,
    (_match, key: string) => {
      const value = variables[key]

      return escapeValues
        ? escapedHtml(value)
        : String(value ?? "")
    },
  )
}

export function wrapSystemEmailHtml(options: {
  heading: string
  bodyHtml: string
  actionLabel?: string | null
  actionUrl?: string | null
}): string {
  const action =
    options.actionLabel && options.actionUrl
      ? `
        <p style="margin:24px 0">
          <a
            href="${escapedHtml(options.actionUrl)}"
            style="
              display:inline-block;
              padding:11px 18px;
              border:1px solid #111827;
              color:#111827;
              text-decoration:none;
              font-weight:600;
            "
          >
            ${escapedHtml(options.actionLabel)}
          </a>
        </p>
      `
      : ""

  return `
<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f5f5f5;font-family:Arial,sans-serif;color:#111827">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td align="center" style="padding:32px 16px">
          <table
            width="100%"
            cellpadding="0"
            cellspacing="0"
            role="presentation"
            style="max-width:640px;background:#ffffff;border:1px solid #d1d5db"
          >
            <tr>
              <td style="padding:22px 28px;border-bottom:1px solid #e5e7eb">
                <strong style="font-size:18px">Q-NXUS</strong>
              </td>
            </tr>

            <tr>
              <td style="padding:28px">
                <h1 style="margin:0 0 18px;font-size:22px">
                  ${escapedHtml(options.heading)}
                </h1>

                <div style="font-size:15px;line-height:1.65">
                  ${options.bodyHtml}
                </div>

                ${action}
              </td>
            </tr>

            <tr>
              <td style="padding:18px 28px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280">
                This is an automated message from Q-NXUS.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim()
}
