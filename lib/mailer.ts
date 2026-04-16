import nodemailer from "nodemailer";

/**
 * Generic SMTP email sender for PrintPerfect.
 * Configured via environment variables:
 *   SMTP_HOST: SMTP server hostname
 *   SMTP_PORT: SMTP port (default: 587)
 *   SMTP_USER: SMTP username/email
 *   SMTP_PASS: SMTP password or app-specific password
 *   ADMIN_EMAIL: Recipient email for admin notifications
 *
 * Common providers:
 *   Gmail: smtp.gmail.com:587 (use app-specific password)
 *   Brevo (Sendinblue): smtp-relay.brevo.com:587
 *   SendGrid: smtp.sendgrid.net:587 (user: "apikey", pass: "SG.xxx")
 */

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  // Only initialize once
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  // Skip if not configured
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[Mailer] SMTP not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env.local"
      );
    }
    return null;
  }

  try {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT || "587", 10),
      secure: (SMTP_PORT || "587") === "465", // true for 465, false for other ports
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    return transporter;
  } catch (error) {
    console.error("[Mailer] Failed to create transporter:", error);
    return null;
  }
}

/**
 * Send an email notification to admin about a new equipment suggestion.
 * Returns true if sent successfully, false if mail is not configured.
 */
export async function sendEquipmentSuggestionNotification(
  equipmentType: "printer" | "surface" | "nozzle",
  name: string,
  description: string,
  characteristics?: string
): Promise<boolean> {
  const transport = getTransporter();
  if (!transport) {
    if (process.env.NODE_ENV === "development") {
      console.log(
        `[Mailer] (Not sent — SMTP not configured) Equipment suggestion: ${equipmentType} - ${name}`
      );
    }
    return false;
  }

  const adminEmail = process.env.ADMIN_EMAIL || "info@printperfect.app";
  const smtpUser = process.env.SMTP_USER || "noreply@printperfect.app";

  const typeLabel =
    equipmentType === "printer"
      ? "Printer"
      : equipmentType === "surface"
      ? "Bed Surface"
      : "Nozzle";

  const htmlContent = `
    <h2>New Equipment Suggestion: ${typeLabel}</h2>
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Description:</strong></p>
    <p>${escapeHtml(description).replace(/\n/g, "<br />")}</p>
    ${
      characteristics
        ? `<p><strong>Characteristics:</strong></p>
         <p>${escapeHtml(characteristics).replace(/\n/g, "<br />")}</p>`
        : ""
    }
    <hr />
    <p style="font-size: 0.9em; color: #666;">
      Review this suggestion in the <a href="https://printperfect.app/admin/settings">admin panel</a>.
    </p>
  `;

  const textContent = `
New Equipment Suggestion: ${typeLabel}

Name: ${name}

Description:
${description}

${characteristics ? `Characteristics:\n${characteristics}` : ""}

---
Review this suggestion in the admin panel: https://printperfect.app/admin/settings
  `.trim();

  try {
    await transport.sendMail({
      from: smtpUser,
      to: adminEmail,
      subject: `[PrintPerfect] New ${typeLabel} Suggestion: ${name}`,
      html: htmlContent,
      text: textContent,
    });

    console.log(
      `[Mailer] Sent equipment suggestion notification to ${adminEmail}`
    );
    return true;
  } catch (error) {
    console.error("[Mailer] Failed to send equipment suggestion email:", error);
    return false;
  }
}

/**
 * Escape HTML entities to prevent injection in email content.
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}
