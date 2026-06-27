export interface EmailDeliveryResult {
  success: boolean;
  provider: "sendgrid" | "none";
  messageId?: string;
  error?: string;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
  from?: string;
}

/**
 * Send transactional email via SendGrid when SENDGRID_API_KEY is configured.
 * Falls back to logging-only in development when the key is absent.
 */
export async function sendTransactionalEmail(params: SendEmailParams): Promise<EmailDeliveryResult> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = params.from ?? process.env.SENDGRID_FROM_EMAIL ?? "noreply@academyos.org";

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      return {
        success: false,
        provider: "none",
        error: "SENDGRID_API_KEY is required in production",
      };
    }
    return { success: false, provider: "none", error: "Email provider not configured" };
  }

  if (!params.to?.includes("@")) {
    return { success: false, provider: "sendgrid", error: "Invalid recipient email" };
  }

  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: params.to }] }],
        from: { email: fromEmail, name: process.env.SENDGRID_FROM_NAME ?? "AcademyOS" },
        subject: params.subject,
        content: [{ type: "text/html", value: params.body.replace(/\n/g, "<br>") }],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return { success: false, provider: "sendgrid", error: detail || response.statusText };
    }

    const messageId = response.headers.get("x-message-id") ?? undefined;
    return { success: true, provider: "sendgrid", messageId };
  } catch (err) {
    return {
      success: false,
      provider: "sendgrid",
      error: err instanceof Error ? err.message : "SendGrid request failed",
    };
  }
}
