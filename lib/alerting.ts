/**
 * @file lib/alerting.ts
 * @description Cost and health monitoring alerts system.
 *
 * Provides fire-and-forget email alerting when API costs or error rates exceed
 * configurable thresholds. Uses KV-based deduplication to prevent alert spam
 * (max 1 alert per type per hour).
 *
 * KV KEY SCHEMA:
 *   "alert:sent:cost:{YYYY-MM-DD-HH}"      — cost spike alert sent (1h TTL)
 *   "alert:sent:error:{YYYY-MM-DD-HH}"     — error spike alert sent (1h TTL)
 *   "alert:sent:downtime:{YYYY-MM-DD-HH}"  — downtime alert sent (1h TTL)
 */

import { AppConfig } from "@/lib/config";
import type { ApiStats } from "@/lib/abuseMonitor";

/**
 * Checks if any alert thresholds are exceeded and sends notifications.
 * Never throws — always completes silently even if email fails.
 *
 * @param stats — API statistics from getApiStats()
 * @param config — Application config with alert settings
 */
export async function checkAndAlert(stats: ApiStats, config: AppConfig): Promise<void> {
  try {
    // Only proceed if email is configured
    if (!config.alertEmail || config.alertEmail === "admin@printperfect.app") {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "[alerting] Alert email not configured. Set ADMIN_EMAIL in .env.local"
        );
      }
      return;
    }

    // Check cost spike alert
    if (
      config.alertOnCostSpike &&
      stats.costMetrics.today > config.dailyCostThreshold
    ) {
      await sendCostSpikeAlertWithDedup(
        stats.costMetrics.today,
        config.dailyCostThreshold,
        config.alertEmail
      );
    }

    // Check error spike alert (not implemented yet — can add in Stage 3b)
    // if (config.alertOnErrorSpike && errorRate > config.errorRateThreshold) {
    //   await sendErrorSpikeAlertWithDedup(...)
    // }
  } catch (err) {
    // Silently swallow — alerting failure must not break the request
    if (process.env.NODE_ENV === "development") {
      console.warn("[alerting] Alert check failed:", err);
    }
  }
}

/**
 * Sends a cost spike alert email with hourly deduplication.
 * Uses KV to track sent alerts — max 1 per hour.
 */
async function sendCostSpikeAlertWithDedup(
  dailyCost: number,
  threshold: number,
  email: string
): Promise<void> {
  const now = new Date();
  const hourKey = `alert:sent:cost:${now.toISOString().slice(0, 13)}`; // "YYYY-MM-DDTHH"

  try {
    const { kv } = await import("@vercel/kv");

    // Check if alert already sent this hour
    const alreadySent = await kv.get<boolean>(hourKey);
    if (alreadySent) {
      if (process.env.NODE_ENV === "development") {
        console.log("[alerting] Cost spike alert already sent this hour, skipping");
      }
      return;
    }

    // Mark alert as sent (1-hour TTL)
    await kv.set(hourKey, true, { ex: 3600 });

    // Send email (fire-and-forget via sendMail implementation)
    await sendCostSpikeEmail(dailyCost, threshold, email);
  } catch (err) {
    // Silently swallow dedup or KV errors
    if (process.env.NODE_ENV === "development") {
      console.warn("[alerting] Cost spike dedup check failed:", err);
    }
  }
}

/**
 * Sends cost spike alert email.
 * Structured similarly to sendEquipmentSuggestionNotification.
 */
async function sendCostSpikeEmail(
  dailyCost: number,
  threshold: number,
  email: string
): Promise<void> {
  try {
    const nodemailer = await import("nodemailer");

    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

    // Skip if not configured
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "[alerting] SMTP not configured. Cost spike would be: $" +
            dailyCost.toFixed(2)
        );
      }
      return;
    }

    const transporter = nodemailer.default.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT || "587", 10),
      secure: (SMTP_PORT || "587") === "465",
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    const htmlContent = `
      <h2 style="color: #d97706;">🚨 Daily Spend Alert</h2>
      <p>Your PrintPerfect API spending has exceeded the configured threshold.</p>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background-color: #f3f4f6;">
          <td style="padding: 12px; border: 1px solid #e5e7eb;"><strong>Today's Spend:</strong></td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #d97706; font-weight: bold;">$${dailyCost.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding: 12px; border: 1px solid #e5e7eb;"><strong>Alert Threshold:</strong></td>
          <td style="padding: 12px; border: 1px solid #e5e7eb;">$${threshold.toFixed(2)}</td>
        </tr>
        <tr style="background-color: #f3f4f6;">
          <td style="padding: 12px; border: 1px solid #e5e7eb;"><strong>Overage:</strong></td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #d97706;">$${(dailyCost - threshold).toFixed(2)}</td>
        </tr>
      </table>

      <p><a href="https://printperfect.app/admin/monitoring" style="display: inline-block; padding: 10px 20px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px;">View Monitoring Dashboard</a></p>

      <p style="margin-top: 30px; font-size: 0.9em; color: #666;">
        You can adjust the alert threshold in <a href="https://printperfect.app/admin/settings">Admin → Settings → Alert Configuration</a>.
      </p>
    `;

    const textContent = `
🚨 Daily Spend Alert

Your PrintPerfect API spending has exceeded the configured threshold.

Today's Spend:     $${dailyCost.toFixed(2)}
Alert Threshold:   $${threshold.toFixed(2)}
Overage:           $${(dailyCost - threshold).toFixed(2)}

View your monitoring dashboard:
https://printperfect.app/admin/monitoring

Adjust the alert threshold:
https://printperfect.app/admin/settings
    `.trim();

    await transporter.sendMail({
      from: SMTP_USER,
      to: email,
      subject: `[PrintPerfect Alert] Daily spend exceeded: $${dailyCost.toFixed(2)}`,
      html: htmlContent,
      text: textContent,
    });

    if (process.env.NODE_ENV === "development") {
      console.log(
        `[alerting] Cost spike alert sent to ${email} (spent $${dailyCost.toFixed(2)} of $${threshold.toFixed(2)})`
      );
    }
  } catch (err) {
    // Silently swallow email send errors
    if (process.env.NODE_ENV === "development") {
      console.error("[alerting] Failed to send cost spike email:", err);
    }
  }
}

/**
 * Placeholder for error spike alerts — can be implemented in Stage 3b.
 * Would check error_rate against threshold and send similar structured email.
 */
export async function sendErrorSpikeAlertWithDedup(
  _errorRate: number,
  _threshold: number,
  _email: string
): Promise<void> {
  // TODO: Implement in Stage 3b
}

/**
 * Placeholder for downtime alerts — can be implemented in Stage 3c.
 * Would track last successful request and alert if unavailable too long.
 */
export async function sendDowntimeAlertWithDedup(
  _duration: number,
  _email: string
): Promise<void> {
  // TODO: Implement in Stage 3c
}
