// Minimal Instamojo v2 client (OAuth2 client_credentials).
// Mirrors the calls the WP plugin made: createPayment, getPaymentDetails,
// getPaymentRequest, getPayoutDetails.

const TOKEN_URL = "https://api.instamojo.com/oauth2/token/";
const API_BASE = "https://api.instamojo.com/v2";

export type InstamojoConfig = {
  clientId: string;
  clientSecret: string;
};

export type CreatePaymentInput = {
  purpose: string;
  amount: number;
  buyer_name: string;
  email: string;
  phone: string;
  redirect_url: string;
  webhook: string;
};

export type CreatePaymentResponse = {
  id?: string;
  longurl?: string;
  [k: string]: unknown;
};

async function getAccessToken(cfg: InstamojoConfig): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(`Instamojo auth failed: ${res.status} ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

async function authedFetch(
  cfg: InstamojoConfig,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getAccessToken(cfg);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

export async function createPayment(
  cfg: InstamojoConfig,
  input: CreatePaymentInput,
): Promise<CreatePaymentResponse> {
  const body = new URLSearchParams({
    purpose: input.purpose,
    amount: String(input.amount),
    buyer_name: input.buyer_name,
    email: input.email,
    phone: input.phone,
    redirect_url: input.redirect_url,
    webhook: input.webhook,
    send_email: "False",
    allow_repeated_payments: "False",
  });
  const res = await authedFetch(cfg, `${API_BASE}/payment_requests/`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  return (await res.json()) as CreatePaymentResponse;
}

export type PaymentDetails = {
  id?: string;
  // Instamojo serializes payment status differently per endpoint/version:
  // number 1, string "1", boolean true, or string "Credit" all mean success.
  status?: number | string | boolean;
  payment_request?: string;
  created_at?: string;
  payout?: string;
  total_taxes?: string | number;
  fees?: string | number;
  [k: string]: unknown;
};

// True iff this payment is in the "Credit" (successful) terminal state.
// Accepts every shape Instamojo has been observed to return.
export function isPaymentCredit(verify: PaymentDetails): boolean {
  const s = verify.status as unknown;
  return s === 1 || s === true || s === "1" || s === "Credit";
}

export async function getPaymentDetails(
  cfg: InstamojoConfig,
  paymentId: string,
): Promise<PaymentDetails> {
  const res = await authedFetch(cfg, `${API_BASE}/payments/${paymentId}/`);
  return (await res.json()) as PaymentDetails;
}

export type PaymentRequest = {
  id?: string;
  payments?: string[];
  [k: string]: unknown;
};

export async function getPaymentRequest(
  cfg: InstamojoConfig,
  paymentRequestId: string,
): Promise<PaymentRequest> {
  const res = await authedFetch(cfg, `${API_BASE}/payment_requests/${paymentRequestId}/`);
  return (await res.json()) as PaymentRequest;
}

export async function getPayoutDetails(
  cfg: InstamojoConfig,
  payoutEndpoint: string,
): Promise<Record<string, unknown>> {
  const res = await authedFetch(cfg, payoutEndpoint);
  return (await res.json()) as Record<string, unknown>;
}

// Build the Instamojo payment_request URL we use to verify against
// `verify.payment_request` in the webhook.
export function paymentRequestUrl(paymentRequestId: string): string {
  return `${API_BASE}/payment_requests/${paymentRequestId}/`;
}
