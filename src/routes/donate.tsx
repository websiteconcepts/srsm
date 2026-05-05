import { Hono } from "hono";
import type { Env, Donation, Variables } from "../types";
import { Layout } from "../views/layout";
import { DonateForm, DonateStatus, RegisterAndDonatePage } from "../views/donate";
import {
  allocateReceiptNumber,
  buildReceiptHtml,
  loadDonationTiers,
  ORG,
  parseAndValidate,
  type DonationFormInput,
} from "../donations";
import {
  createPayment,
  getPaymentDetails,
  isPaymentCredit,
  paymentRequestUrl,
  type InstamojoConfig,
} from "../instamojo";
import { sendEmail } from "../brevo";

export const donateRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

function instamojoCfg(c: { env: Env }): InstamojoConfig {
  return {
    clientId: c.env.INSTAMOJO_CLIENT_ID,
    clientSecret: c.env.INSTAMOJO_CLIENT_SECRET,
  };
}

function siteOrigin(reqUrl: string): string {
  const u = new URL(reqUrl);
  return `${u.protocol}//${u.host}`;
}

// GET /donate
donateRoutes.get("/donate", async (c) => {
  const tiers = await loadDonationTiers(c.env.DB);
  return c.html(
    <Layout title="Donate" siteName={c.env.SITE_NAME} user={c.get("user")}>
      <DonateForm tiers={tiers} />
    </Layout>,
  );
});

// GET /connect-and-contribute — combined registration iframe + donation form.
const REGISTER_IFRAME_URL = "https://www.sanatanevents.net/register/2/open";

donateRoutes.get("/connect-and-contribute", async (c) => {
  const tiers = await loadDonationTiers(c.env.DB);
  return c.html(
    <Layout
      title="Connect & Contribute"
      siteName={c.env.SITE_NAME}
      user={c.get("user")}
    >
      <RegisterAndDonatePage tiers={tiers} registerUrl={REGISTER_IFRAME_URL} />
    </Layout>,
  );
});

// Old URL kept as a permanent redirect so any external links keep working.
donateRoutes.get("/register", (c) => c.redirect("/connect-and-contribute", 301));

// POST /donate
donateRoutes.post("/donate", async (c) => {
  const body = (await c.req.parseBody()) as Record<string, string>;
  const parsed = parseAndValidate(body as unknown as DonationFormInput);
  const tiers = await loadDonationTiers(c.env.DB);

  if (!parsed.ok) {
    const message = parsed.errors.map((e) => e.message).join(" ");
    return c.html(
      <Layout title="Donate" siteName={c.env.SITE_NAME} user={c.get("user")}>
        <DonateForm tiers={tiers} error={message} values={body} />
      </Layout>,
      400,
    );
  }

  const d = parsed.data;
  const origin = siteOrigin(c.req.url);

  if (!c.env.INSTAMOJO_CLIENT_ID || !c.env.INSTAMOJO_CLIENT_SECRET) {
    return c.html(
      <Layout title="Donate" siteName={c.env.SITE_NAME} user={c.get("user")}>
        <DonateForm tiers={tiers} error="Payment gateway not configured. Please try again later." values={body} />
      </Layout>,
      500,
    );
  }

  let payRes;
  try {
    payRes = await createPayment(instamojoCfg(c), {
      purpose: d.purpose,
      amount: d.amount,
      buyer_name: d.name,
      email: d.email,
      phone: d.phone,
      redirect_url: `${origin}/donate/status`,
      webhook: `${origin}/webhooks/instamojo`,
    });
  } catch (err) {
    console.error("Instamojo createPayment failed", err);
    return c.html(
      <Layout title="Donate" siteName={c.env.SITE_NAME} user={c.get("user")}>
        <DonateForm
          tiers={tiers}
          error="Could not start payment. Please try again in a moment."
          values={body}
        />
      </Layout>,
      502,
    );
  }

  if (!payRes.id || !payRes.longurl) {
    console.error("Instamojo createPayment unexpected response", payRes);
    return c.html(
      <Layout title="Donate" siteName={c.env.SITE_NAME} user={c.get("user")}>
        <DonateForm
          tiers={tiers}
          error="Payment gateway returned an error. Please try again."
          values={body}
        />
      </Layout>,
      502,
    );
  }

  await c.env.DB.prepare(
    `INSERT INTO donations
       (payment_request_id, buyer_name, buyer_email, amount, buyer_phone,
        status, purpose, currency, pan, full_address)
     VALUES (?, ?, ?, ?, ?, 'Pending', ?, 'INR', ?, ?)`,
  )
    .bind(payRes.id, d.name, d.email, d.amount, d.phone, d.purpose, d.pan, d.address)
    .run();

  return c.redirect(payRes.longurl);
});

// GET /donate/status — Instamojo redirects donor here after payment.
donateRoutes.get("/donate/status", async (c) => {
  const status = c.req.query("payment_status");
  const requestId = c.req.query("payment_request_id");
  let receipt: string | null = null;

  if (requestId) {
    const row = await c.env.DB.prepare(
      "SELECT receipt FROM donations WHERE payment_request_id = ?",
    )
      .bind(requestId)
      .first<{ receipt: string | null }>();
    receipt = row?.receipt ?? null;
  }

  // Instamojo sends payment_status=Credit on success.
  const ok = status === "Credit";
  return c.html(
    <Layout title={ok ? "Thank you" : "Payment status"} siteName={c.env.SITE_NAME} user={c.get("user")}>
      <DonateStatus ok={ok} receipt={receipt} />
    </Layout>,
  );
});

// POST /webhooks/instamojo — server-to-server callback.
donateRoutes.post("/webhooks/instamojo", async (c) => {
  const body = (await c.req.parseBody()) as Record<string, string>;
  const paymentId = body.payment_id ?? "";
  const paymentRequestId = body.payment_request_id ?? "";

  if (!paymentId || !paymentRequestId) {
    return c.text("missing fields", 400);
  }

  // Verify with Instamojo before trusting the webhook.
  let verify;
  try {
    verify = await getPaymentDetails(instamojoCfg(c), paymentId);
  } catch (err) {
    console.error("verify failed", err);
    return c.text("verify failed", 502);
  }

  const expectedReq = paymentRequestUrl(paymentRequestId);
  if (!isPaymentCredit(verify) || verify.payment_request !== expectedReq) {
    console.error("[webhook/instamojo] verification failed", {
      status: verify.status,
      payment_request: verify.payment_request,
      expected: expectedReq,
    });
    return c.text("verification failed", 403);
  }

  // Mark paid + capture transaction date.
  let txnUnix: number | null = null;
  if (typeof verify.created_at === "string") {
    const t = Date.parse(verify.created_at);
    if (!Number.isNaN(t)) txnUnix = Math.floor(t / 1000);
  }
  await c.env.DB.prepare(
    `UPDATE donations
       SET payment_id = ?, status = 'Credit', transaction_date = COALESCE(?, transaction_date)
     WHERE payment_request_id = ?`,
  )
    .bind(paymentId, txnUnix, paymentRequestId)
    .run();

  // Reload row.
  const donation = await c.env.DB.prepare(
    "SELECT * FROM donations WHERE payment_request_id = ?",
  )
    .bind(paymentRequestId)
    .first<Donation>();
  if (!donation) return c.text("donation not found", 404);

  // Allocate receipt if not already set.
  let receipt = donation.receipt;
  if (!receipt) {
    receipt = await allocateReceiptNumber(c.env.DB, donation.id);
    donation.receipt = receipt;
  }

  // Send email receipt (best-effort — webhook should still 200 if email fails).
  if (c.env.BREVO_API_KEY) {
    try {
      await sendEmail({
        apiKey: c.env.BREVO_API_KEY,
        fromName: ORG.emailFromName,
        fromEmail: ORG.emailFrom,
        toName: donation.buyer_name,
        toEmail: donation.buyer_email,
        bccName: ORG.emailFromName,
        bccEmail: ORG.emailBcc,
        subject: ORG.emailSubject,
        htmlContent: buildReceiptHtml(donation),
      });
    } catch (err) {
      console.error("brevo email failed (will not retry)", err);
    }
  } else {
    console.warn("BREVO_API_KEY not set — receipt email skipped");
  }

  return c.text("OK", 200);
});
