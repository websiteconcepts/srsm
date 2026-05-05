// Donation domain helpers: validation, receipt-number allocation, email body.

import type { Donation, DonationTier } from "./types";

// Donation tiers are stored in D1 (`donation_tiers` table) and managed from
// the admin UI. Use loadDonationTiers() to read them.
export async function loadDonationTiers(db: D1Database): Promise<DonationTier[]> {
  const { results } = await db
    .prepare("SELECT * FROM donation_tiers ORDER BY sort_order, id")
    .all<DonationTier>();
  return results ?? [];
}

export const ORG = {
  name: "Sanatan Sanstha",
  pan: "AACTS1753J",
  reg80g: "AACTS1753JF19997 (valid AY 2022-23 to AY 2026-27)",
  registrationNo: "1/IV/2, Ponda Goa",
  regOffice: "Sanatan Ashram, 24/B, Ramnathi village, Bandoda, Ponda, Goa - 403 401.",
  emailFromName: "Sanatan Sanstha",
  emailFrom: "webmaster@sanatan.org",
  emailBcc: "lekhasanatan2020@gmail.com",
  emailSubject: "Dhanyavad for your donation to Sanatan Sanstha!",
  receiptPrefix: "SRSM",
};

export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
export const PHONE_REGEX = /^[6-9]\d{9}$/;

export type DonationFormInput = {
  name: string;
  email: string;
  phone: string;
  pan_number: string;
  address: string;
  amount_option: string;   // "5001|Dharmasevak" | "" | "<num>|Custom Amount"
  other_amount: string;
};

export type ParsedDonation = {
  amount: number;
  purpose: string;
  name: string;
  email: string;
  phone: string;
  pan: string;
  address: string;
};

export type ValidationError = { field: string; message: string };

export function parseAndValidate(
  form: DonationFormInput,
): { ok: true; data: ParsedDonation } | { ok: false; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  const name = (form.name ?? "").trim();
  const email = (form.email ?? "").trim().toLowerCase();
  const phone = (form.phone ?? "").replace(/\D/g, "");
  const pan = (form.pan_number ?? "").trim().toUpperCase();
  const address = (form.address ?? "").trim();
  const amountOpt = (form.amount_option ?? "").trim();
  const other = parseFloat(form.other_amount ?? "");

  if (!name) errors.push({ field: "name", message: "Full name is required." });
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    errors.push({ field: "email", message: "Valid email is required." });
  if (!PHONE_REGEX.test(phone))
    errors.push({ field: "phone", message: "Enter a 10-digit Indian mobile (starts with 6-9)." });
  if (!PAN_REGEX.test(pan))
    errors.push({ field: "pan_number", message: "Enter a valid PAN (ABCDE1234F)." });
  if (!address) errors.push({ field: "address", message: "Address is required." });

  let amount = 0;
  let purpose = "Donation";
  if (!amountOpt || amountOpt.toLowerCase().includes("custom")) {
    amount = isFinite(other) ? other : 0;
    purpose = "Donation (Custom Amount)";
  } else {
    const [a, p] = amountOpt.split("|");
    amount = parseFloat(a);
    if (p) purpose = p;
  }

  if (!isFinite(amount) || amount < 101) {
    errors.push({ field: "amount", message: "Minimum donation is ₹101." });
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: { amount: Math.round(amount), purpose, name, email, phone, pan, address },
  };
}

// Indian financial year for a given JS Date (returns "2025-26" form).
export function financialYearOf(d: Date): string {
  // FY runs Apr 1 -> Mar 31. We anchor to IST so a UTC midnight on Apr 1 IST
  // doesn't roll back. Convert wall-clock to IST (UTC+5:30).
  const ist = new Date(d.getTime() + (5 * 60 + 30) * 60_000);
  const m = ist.getUTCMonth(); // 0=Jan
  const y = ist.getUTCFullYear();
  const startYear = m >= 3 ? y : y - 1; // Apr (3) onwards starts new FY
  const endYearShort = String((startYear + 1) % 100).padStart(2, "0");
  return `${startYear}-${endYearShort}`;
}

// Atomically allocate the next receipt number for the current FY and write it
// to the donation row. Returns the receipt string.
export async function allocateReceiptNumber(
  db: D1Database,
  donationId: number,
  now: Date = new Date(),
): Promise<string> {
  const fy = financialYearOf(now);
  const row = await db
    .prepare(
      `INSERT INTO donation_fy_counters (fy, alphabet, count) VALUES (?, 'A', 1)
       ON CONFLICT(fy) DO UPDATE SET count = count + 1
       RETURNING fy, alphabet, count`,
    )
    .bind(fy)
    .first<{ fy: string; alphabet: string; count: number }>();
  if (!row) throw new Error("Failed to allocate receipt counter");

  const receipt = `${ORG.receiptPrefix}/${row.fy}/${row.alphabet}/${String(row.count).padStart(5, "0")}`;
  await db
    .prepare("UPDATE donations SET receipt = ? WHERE id = ?")
    .bind(receipt, donationId)
    .run();
  return receipt;
}

// HTML email body — kept visually close to the WP plugin's receipt.
export function buildReceiptHtml(d: Donation): string {
  const transactionDate = d.transaction_date
    ? new Date(d.transaction_date * 1000).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      })
    : new Date(d.created_at * 1000).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      });
  const escape = (s: string | null | undefined) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  return `
<div style="width:800px;max-width:100%;margin:0 auto;font-family:Arial,sans-serif;">
  <table border="0" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;">
    <tr style="background:#FEFAE9;border:1px solid #978a8a;">
      <td style="padding:16px;">
        <table border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding-right:16px;">
              <img src="https://www.sanatan.org/en/wp-content/uploads/sites/6/2018/06/ss_logo.png"
                   alt="Sanatan Sanstha" height="80" style="display:block;">
            </td>
            <td>
              <div style="color:#024ea0;font-weight:600;font-size:28px;line-height:1;">
                ${ORG.name}
              </div>
              <div style="color:#EA1D23;font-weight:600;font-size:18px;line-height:2;">
                Path for Rapid Spiritual Progress!
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr style="border-left:1px solid #b3b1b0;border-right:1px solid #b3b1b0;">
      <td style="padding:24px;background:#fff;">
        <div style="text-align:center;color:#cb4f07;font-size:24px;font-weight:600;margin-bottom:16px;">
          Donation Receipt
        </div>
        <table border="0" cellspacing="0" cellpadding="8" style="width:100%;font-size:16px;color:#222;">
          <tr>
            <td><strong>Receipt No.:</strong> ${escape(d.receipt)}</td>
            <td><strong>Date:</strong> ${escape(transactionDate)}</td>
          </tr>
          <tr>
            <td><strong>Received with thanks from:</strong></td>
            <td><strong>Purpose:</strong> ${escape(d.purpose)}</td>
          </tr>
          <tr>
            <td>${escape(d.buyer_name)}</td>
            <td><strong>Payment method:</strong> Online payment</td>
          </tr>
          <tr>
            <td><strong>Email:</strong> ${escape(d.buyer_email)}</td>
            <td><strong>Amount:</strong> ₹ ${d.amount} ${escape(d.currency)}</td>
          </tr>
          <tr>
            <td><strong>Your PAN:</strong> ${escape(d.pan)}</td>
            <td><strong>Our PAN:</strong> ${ORG.pan}</td>
          </tr>
          <tr>
            <td><strong>Address:</strong> ${escape(d.full_address)}</td>
            <td><strong>Registration No.:</strong> ${ORG.registrationNo}</td>
          </tr>
        </table>

        <div style="margin-top:16px;font-size:12px;color:#555;line-height:1.5;">
          <p><strong>Note:</strong> This is a computer generated receipt.</p>
          <p><strong>Reg. Off:</strong> ${ORG.regOffice}</p>
          <p><strong>80G Information:</strong> The recognition granted u/s 80G of the Income Tax Act, 1961, vide Unique Registration Number ${ORG.reg80g}.</p>
        </div>
      </td>
    </tr>

    <tr>
      <td align="center" style="padding:16px;background:#FEFAE9;border:1px solid #978a8a;color:#034da2;font-size:14px;">
        &copy; ${new Date().getFullYear()} ${ORG.name} &nbsp;|&nbsp; contact@sanatan.org
      </td>
    </tr>
  </table>
</div>`;
}
