// Minimal Brevo (Sendinblue) transactional email client.

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

export type BrevoSendInput = {
  apiKey: string;
  fromName: string;
  fromEmail: string;
  toName: string;
  toEmail: string;
  bccName?: string;
  bccEmail?: string;
  subject: string;
  htmlContent: string;
};

export async function sendEmail(input: BrevoSendInput): Promise<void> {
  const payload: Record<string, unknown> = {
    sender: { name: input.fromName, email: input.fromEmail },
    to: [{ name: input.toName, email: input.toEmail }],
    subject: input.subject,
    htmlContent: input.htmlContent,
  };
  if (input.bccEmail) {
    payload.bcc = [{ name: input.bccName ?? input.bccEmail, email: input.bccEmail }];
  }

  const res = await fetch(BREVO_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "api-key": input.apiKey,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Brevo send failed: ${res.status} ${detail}`);
  }
}
