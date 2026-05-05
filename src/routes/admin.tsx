import { Hono, type Context } from "hono";
import type {
  Donation,
  DonationTier,
  Env,
  Event,
  EventPhoto,
  User,
  Variables,
} from "../types";
import { Layout } from "../views/layout";
import {
  AdminHome,
  AdminSettings,
  EventForm,
  EventsDashboard,
  LoginForm,
  SetupForm,
  UsersPage,
} from "../views/admin";
import { DonationsAdminList, DonationTiersAdmin } from "../views/donate";
import { loadDonationTiers } from "../donations";
import {
  createSession,
  destroySession,
  hashPassword,
  requireUser,
  verifyPassword,
} from "../auth";
import { parseDateTimeLocalToUnix, slugify } from "../utils";

export const adminRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

async function countUsers(db: D1Database): Promise<number> {
  const row = await db.prepare("SELECT COUNT(*) AS c FROM users").first<{ c: number }>();
  return row?.c ?? 0;
}

async function uniqueSlug(db: D1Database, base: string, excludeId?: number): Promise<string> {
  const root = slugify(base) || "event";
  let slug = root;
  let n = 2;
  while (true) {
    const row = await db
      .prepare("SELECT id FROM events WHERE slug = ? AND id IS NOT ?")
      .bind(slug, excludeId ?? null)
      .first<{ id: number }>();
    if (!row) return slug;
    slug = `${root}-${n++}`;
  }
}

function extFromFilename(name: string): string {
  const i = name.lastIndexOf(".");
  if (i < 0) return "";
  return name.slice(i).toLowerCase().replace(/[^a-z0-9.]/g, "");
}

async function putImage(
  r2: R2Bucket,
  file: File,
  keyPrefix: string,
): Promise<string> {
  const ext = extFromFilename(file.name) || ".jpg";
  const key = `${keyPrefix}/${crypto.randomUUID()}${ext}`;
  await r2.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
  });
  return key;
}

function isNonEmptyFile(v: unknown): v is File {
  return v instanceof File && v.size > 0;
}

// ---------------- login / setup / logout ----------------

adminRoutes.get("/login", async (c) => {
  if ((await countUsers(c.env.DB)) === 0) return c.redirect("/admin/setup");
  if (c.get("user")) return c.redirect("/admin");
  const next = c.req.query("next") ?? "";
  return c.html(
    <Layout title="Sign in" siteName={c.env.SITE_NAME} user={c.get("user")}>
      <LoginForm next={next} />
    </Layout>,
  );
});

adminRoutes.post("/login", async (c) => {
  const form = await c.req.parseBody();
  const email = String(form.email ?? "").trim().toLowerCase();
  const password = String(form.password ?? "");
  const next = String(form.next ?? "") || "/admin";
  const user = await c.env.DB.prepare("SELECT * FROM users WHERE email = ?")
    .bind(email)
    .first<User>();
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return c.html(
      <Layout title="Sign in" siteName={c.env.SITE_NAME}>
        <LoginForm error="Invalid email or password." next={next} />
      </Layout>,
      401,
    );
  }
  await createSession(c, user.id);
  return c.redirect(next.startsWith("/") ? next : "/admin");
});

adminRoutes.get("/setup", async (c) => {
  if ((await countUsers(c.env.DB)) > 0) return c.redirect("/admin/login");
  return c.html(
    <Layout title="Setup" siteName={c.env.SITE_NAME}>
      <SetupForm />
    </Layout>,
  );
});

adminRoutes.post("/setup", async (c) => {
  if ((await countUsers(c.env.DB)) > 0) return c.redirect("/admin/login");
  const form = await c.req.parseBody();
  const name = String(form.name ?? "").trim();
  const email = String(form.email ?? "").trim().toLowerCase();
  const password = String(form.password ?? "");
  if (!name || !email || password.length < 8) {
    return c.html(
      <Layout title="Setup" siteName={c.env.SITE_NAME}>
        <SetupForm error="All fields required. Password must be at least 8 characters." />
      </Layout>,
      400,
    );
  }
  const hash = await hashPassword(password);
  const res = await c.env.DB.prepare(
    "INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, 'owner') RETURNING id",
  )
    .bind(email, name, hash)
    .first<{ id: number }>();
  if (res?.id) await createSession(c, res.id);
  return c.redirect("/admin");
});

adminRoutes.post("/logout", async (c) => {
  await destroySession(c);
  return c.redirect("/");
});

// ---------------- gated routes ----------------

adminRoutes.use("/*", async (c, next) => {
  // Let login/setup pass through (handled above). Everything else requires auth.
  const p = c.req.path;
  if (p === "/admin/login" || p === "/admin/setup" || p === "/admin/logout") {
    return next();
  }
  return requireUser(c, next);
});

// Admin landing page — icon grid.
adminRoutes.get("/", async (c) => {
  const user = c.get("user")!;
  return c.html(
    <Layout title="Admin" siteName={c.env.SITE_NAME} user={user}>
      <AdminHome user={user} />
    </Layout>,
  );
});

// Events list (formerly the /admin landing page).
adminRoutes.get("/events", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM events ORDER BY start_at DESC",
  ).all<Event>();
  return c.html(
    <Layout title="Events" siteName={c.env.SITE_NAME} user={c.get("user")}>
      <EventsDashboard user={c.get("user")!} events={results ?? []} />
    </Layout>,
  );
});

// Settings page — links to Donation tiers (and any future settings).
adminRoutes.get("/settings", async (c) => {
  return c.html(
    <Layout title="Settings" siteName={c.env.SITE_NAME} user={c.get("user")}>
      <AdminSettings />
    </Layout>,
  );
});

// ---------------- event create/edit ----------------

adminRoutes.get("/events/new", async (c) => {
  return c.html(
    <Layout title="New event" siteName={c.env.SITE_NAME} user={c.get("user")}>
      <EventForm user={c.get("user")!} />
    </Layout>,
  );
});

adminRoutes.post("/events", async (c) => {
  const user = c.get("user")!;
  const form = await c.req.parseBody();
  const title = String(form.title ?? "").trim();
  const startAt = parseDateTimeLocalToUnix(String(form.start_at ?? ""));
  if (!title || !startAt) {
    return c.html(
      <Layout title="New event" siteName={c.env.SITE_NAME} user={user}>
        <EventForm user={user} error="Title and start time are required." />
      </Layout>,
      400,
    );
  }
  const slug = await uniqueSlug(c.env.DB, String(form.slug || form.title));
  const endAt = parseDateTimeLocalToUnix(String(form.end_at ?? ""));
  const summary = String(form.summary ?? "").trim();
  const description = String(form.description ?? "");
  const locationName = String(form.location_name ?? "").trim();
  const address = String(form.address ?? "").trim();
  const mapQuery = String(form.map_query ?? "").trim();
  const published = form.published === "1" ? 1 : 0;

  let heroKey: string | null = null;
  const hero = form.hero;
  if (isNonEmptyFile(hero)) {
    heroKey = await putImage(c.env.R2, hero, "events/hero");
  }

  const inserted = await c.env.DB.prepare(
    `INSERT INTO events
       (slug, title, summary, description, start_at, end_at, location_name, address, map_query, hero_r2_key, published, created_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
     RETURNING id`,
  )
    .bind(
      slug,
      title,
      summary,
      description,
      startAt,
      endAt,
      locationName,
      address,
      mapQuery,
      heroKey,
      published,
      user.id,
    )
    .first<{ id: number }>();

  return c.redirect(`/admin/events/${inserted!.id}`);
});

adminRoutes.get("/events/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const event = await c.env.DB.prepare("SELECT * FROM events WHERE id = ?")
    .bind(id)
    .first<Event>();
  if (!event) return c.notFound();
  const { results: photos } = await c.env.DB.prepare(
    "SELECT * FROM event_photos WHERE event_id = ? ORDER BY sort_order, id",
  )
    .bind(id)
    .all<EventPhoto>();
  return c.html(
    <Layout title={event.title} siteName={c.env.SITE_NAME} user={c.get("user")}>
      <EventForm user={c.get("user")!} event={event} photos={photos ?? []} />
    </Layout>,
  );
});

adminRoutes.post("/events/:id", async (c) => {
  const user = c.get("user")!;
  const id = Number(c.req.param("id"));
  const existing = await c.env.DB.prepare("SELECT * FROM events WHERE id = ?")
    .bind(id)
    .first<Event>();
  if (!existing) return c.notFound();

  const form = await c.req.parseBody();
  const title = String(form.title ?? "").trim();
  const startAt = parseDateTimeLocalToUnix(String(form.start_at ?? ""));
  if (!title || !startAt) {
    return c.html(
      <Layout title="Edit event" siteName={c.env.SITE_NAME} user={user}>
        <EventForm user={user} event={existing} error="Title and start time are required." />
      </Layout>,
      400,
    );
  }
  const slugInput = String(form.slug ?? "").trim() || existing.slug;
  const slug =
    slugInput === existing.slug
      ? existing.slug
      : await uniqueSlug(c.env.DB, slugInput, id);
  const endAt = parseDateTimeLocalToUnix(String(form.end_at ?? ""));
  const summary = String(form.summary ?? "").trim();
  const description = String(form.description ?? "");
  const locationName = String(form.location_name ?? "").trim();
  const address = String(form.address ?? "").trim();
  const mapQuery = String(form.map_query ?? "").trim();
  const published = form.published === "1" ? 1 : 0;

  let heroKey = existing.hero_r2_key;
  const hero = form.hero;
  if (isNonEmptyFile(hero)) {
    const newKey = await putImage(c.env.R2, hero, "events/hero");
    if (existing.hero_r2_key) {
      await c.env.R2.delete(existing.hero_r2_key).catch(() => {});
    }
    heroKey = newKey;
  }

  await c.env.DB.prepare(
    `UPDATE events SET
       slug = ?, title = ?, summary = ?, description = ?,
       start_at = ?, end_at = ?, location_name = ?, address = ?,
       map_query = ?, hero_r2_key = ?, published = ?, updated_at = unixepoch()
     WHERE id = ?`,
  )
    .bind(
      slug,
      title,
      summary,
      description,
      startAt,
      endAt,
      locationName,
      address,
      mapQuery,
      heroKey,
      published,
      id,
    )
    .run();

  return c.redirect(`/admin/events/${id}`);
});

adminRoutes.post("/events/:id/delete", async (c) => {
  const id = Number(c.req.param("id"));
  const event = await c.env.DB.prepare("SELECT * FROM events WHERE id = ?")
    .bind(id)
    .first<Event>();
  if (!event) return c.notFound();
  const { results: photos } = await c.env.DB.prepare(
    "SELECT r2_key FROM event_photos WHERE event_id = ?",
  )
    .bind(id)
    .all<{ r2_key: string }>();
  for (const p of photos ?? []) {
    await c.env.R2.delete(p.r2_key).catch(() => {});
  }
  if (event.hero_r2_key) {
    await c.env.R2.delete(event.hero_r2_key).catch(() => {});
  }
  await c.env.DB.prepare("DELETE FROM events WHERE id = ?").bind(id).run();
  return c.redirect("/admin/events");
});

// ---------------- event photos ----------------

adminRoutes.post("/events/:id/photos", async (c) => {
  const user = c.get("user")!;
  const id = Number(c.req.param("id"));
  const event = await c.env.DB.prepare("SELECT id FROM events WHERE id = ?")
    .bind(id)
    .first<{ id: number }>();
  if (!event) return c.notFound();

  const form = await c.req.parseBody({ all: true });
  const raw = form["photos"];
  const files: File[] = Array.isArray(raw) ? raw.filter(isNonEmptyFile) : isNonEmptyFile(raw) ? [raw] : [];

  const nextOrderRow = await c.env.DB.prepare(
    "SELECT COALESCE(MAX(sort_order), 0) AS m FROM event_photos WHERE event_id = ?",
  )
    .bind(id)
    .first<{ m: number }>();
  let sortOrder = (nextOrderRow?.m ?? 0) + 1;

  for (const file of files) {
    const key = await putImage(c.env.R2, file, `events/${id}/gallery`);
    await c.env.DB.prepare(
      `INSERT INTO event_photos (event_id, r2_key, caption, sort_order, uploaded_by)
       VALUES (?, ?, '', ?, ?)`,
    )
      .bind(id, key, sortOrder++, user.id)
      .run();
  }
  return c.redirect(`/admin/events/${id}`);
});

adminRoutes.post("/photos/:id/delete", async (c) => {
  const id = Number(c.req.param("id"));
  const photo = await c.env.DB.prepare("SELECT * FROM event_photos WHERE id = ?")
    .bind(id)
    .first<EventPhoto>();
  if (!photo) return c.notFound();
  await c.env.R2.delete(photo.r2_key).catch(() => {});
  await c.env.DB.prepare("DELETE FROM event_photos WHERE id = ?").bind(id).run();
  return c.redirect(`/admin/events/${photo.event_id}`);
});

// ---------------- users ----------------

adminRoutes.get("/users", async (c) => {
  const user = c.get("user")!;
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM users ORDER BY created_at",
  ).all<User>();
  return c.html(
    <Layout title="Users" siteName={c.env.SITE_NAME} user={user}>
      <UsersPage user={user} users={results ?? []} />
    </Layout>,
  );
});

adminRoutes.post("/users", async (c) => {
  const user = c.get("user")!;
  const form = await c.req.parseBody();
  const name = String(form.name ?? "").trim();
  const email = String(form.email ?? "").trim().toLowerCase();
  const password = String(form.password ?? "");
  if (!name || !email || password.length < 8) {
    const { results } = await c.env.DB.prepare(
      "SELECT * FROM users ORDER BY created_at",
    ).all<User>();
    return c.html(
      <Layout title="Users" siteName={c.env.SITE_NAME} user={user}>
        <UsersPage
          user={user}
          users={results ?? []}
          error="All fields required. Password must be at least 8 characters."
        />
      </Layout>,
      400,
    );
  }
  try {
    const hash = await hashPassword(password);
    await c.env.DB.prepare(
      "INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, 'admin')",
    )
      .bind(email, name, hash)
      .run();
  } catch (err) {
    const { results } = await c.env.DB.prepare(
      "SELECT * FROM users ORDER BY created_at",
    ).all<User>();
    return c.html(
      <Layout title="Users" siteName={c.env.SITE_NAME} user={user}>
        <UsersPage
          user={user}
          users={results ?? []}
          error="Could not create user — email may already be in use."
        />
      </Layout>,
      400,
    );
  }
  return c.redirect("/admin/users");
});

adminRoutes.post("/users/:id/delete", async (c) => {
  const user = c.get("user")!;
  if (user.role !== "owner") return c.text("Forbidden", 403);
  const id = Number(c.req.param("id"));
  if (id === user.id) return c.redirect("/admin/users");
  await c.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
  return c.redirect("/admin/users");
});

adminRoutes.post("/users/password", async (c) => {
  const user = c.get("user")!;
  const form = await c.req.parseBody();
  const current = String(form.current_password ?? "");
  const next = String(form.new_password ?? "");
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM users ORDER BY created_at",
  ).all<User>();

  if (!(await verifyPassword(current, user.password_hash))) {
    return c.html(
      <Layout title="Users" siteName={c.env.SITE_NAME} user={user}>
        <UsersPage user={user} users={results ?? []} error="Current password is incorrect." />
      </Layout>,
      400,
    );
  }
  if (next.length < 8) {
    return c.html(
      <Layout title="Users" siteName={c.env.SITE_NAME} user={user}>
        <UsersPage
          user={user}
          users={results ?? []}
          error="New password must be at least 8 characters."
        />
      </Layout>,
      400,
    );
  }
  const hash = await hashPassword(next);
  await c.env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?")
    .bind(hash, user.id)
    .run();
  return c.redirect("/admin/users");
});

// ---------------- donations ----------------

function donationDisplayDate(d: Donation): string {
  const ts = d.transaction_date ?? d.created_at;
  return new Date(ts * 1000).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

// 'YYYY-MM-DD' (interpreted as IST) → unix epoch at 00:00 IST.
function istDayStartUnix(dateStr: string | undefined | null): number | null {
  if (!dateStr) return null;
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const utcMs = Date.UTC(+y, +mo - 1, +d, 0, 0, 0) - (5 * 60 + 30) * 60_000;
  return Math.floor(utcMs / 1000);
}

// Escape user search input for use inside a `LIKE '%' || ? || '%'` parameter.
// SQLite LIKE wildcards are `%`, `_`. Backslash is the default escape char only
// when ESCAPE clause is set; we set it explicitly below.
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (ch) => "\\" + ch);
}

// Map DataTables' numeric column index → the SQL ORDER BY expression.
// Must mirror the column order in DonationsAdminList's <thead>.
const DONATION_SORT_COLUMNS = [
  "COALESCE(transaction_date, created_at)", // 0 Date
  "buyer_name COLLATE NOCASE",              // 1 Name
  "amount",                                  // 2 Amount
  "purpose COLLATE NOCASE",                  // 3 Purpose
  "status",                                  // 4 Status
  "receipt",                                 // 5 Receipt
];

type DonationFilters = {
  search?: string;
  status?: string;
  fromUnix?: number | null;
  toUnix?: number | null;
};

function buildDonationFilterClause(
  f: DonationFilters,
): { sql: string; binds: unknown[] } {
  const binds: unknown[] = [];
  const clauses: string[] = [];

  if (f.fromUnix != null) {
    clauses.push("created_at >= ?");
    binds.push(f.fromUnix);
  }
  if (f.toUnix != null) {
    clauses.push("created_at < ?");
    binds.push(f.toUnix);
  }
  if (f.status === "Credit" || f.status === "Pending" || f.status === "Failed") {
    clauses.push("status = ?");
    binds.push(f.status);
  }
  if (f.search && f.search.trim()) {
    const term = `%${escapeLike(f.search.trim())}%`;
    clauses.push(
      `(buyer_name LIKE ? ESCAPE '\\'
     OR buyer_email LIKE ? ESCAPE '\\'
     OR buyer_phone LIKE ? ESCAPE '\\'
     OR pan LIKE ? ESCAPE '\\'
     OR purpose LIKE ? ESCAPE '\\'
     OR receipt LIKE ? ESCAPE '\\'
     OR payment_id LIKE ? ESCAPE '\\')`,
    );
    for (let i = 0; i < 7; i++) binds.push(term);
  }

  const sql = clauses.length > 0 ? "WHERE " + clauses.join(" AND ") : "";
  return { sql, binds };
}

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function statusBadgeHtml(status: string): string {
  if (status === "Credit") {
    return `<span class="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">Paid</span>`;
  }
  if (status === "Pending") {
    return `<span class="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">Pending</span>`;
  }
  return `<span class="rounded-full bg-maroon-600/10 px-2 py-1 text-xs font-medium text-maroon-700">Failed</span>`;
}

function actionsHtml(d: Donation): string {
  const label =
    d.status === "Credit" && d.receipt ? "Resend receipt" : "Process / Resend";
  return (
    `<form method="post" action="/admin/donations/${d.id}/process" style="display:inline">` +
    `<button type="submit" class="rounded-md bg-saffron-100 px-3 py-1 text-xs font-semibold text-maroon-700 hover:bg-saffron-200">` +
    htmlEscape(label) +
    `</button></form>`
  );
}

adminRoutes.get("/donations", async (c) => {
  const user = c.get("user")!;
  const totals = await c.env.DB.prepare(
    "SELECT COUNT(*) AS c, COALESCE(SUM(amount), 0) AS s FROM donations WHERE status = 'Credit'",
  ).first<{ c: number; s: number }>();

  const flashKind = c.req.query("flash");
  const flashMsg = c.req.query("msg");
  const flash: { kind: "ok" | "err"; message: string } | undefined =
    flashKind === "ok" || flashKind === "err"
      ? { kind: flashKind as "ok" | "err", message: flashMsg ?? "" }
      : undefined;

  return c.html(
    <Layout title="Donations" siteName={c.env.SITE_NAME} user={user}>
      <DonationsAdminList
        total={{ count: totals?.c ?? 0, sum: totals?.s ?? 0 }}
        flash={flash}
      />
    </Layout>,
  );
});

// DataTables server-side endpoint.
adminRoutes.get("/donations.json", async (c) => {
  const q = c.req.query();
  const draw = Number(q.draw ?? 0) || 0;
  const start = Math.max(0, Number(q.start ?? 0) || 0);
  const lengthRaw = Number(q.length ?? 25) || 25;
  const length = lengthRaw < 0 ? 1000 : Math.min(Math.max(1, lengthRaw), 1000);

  const search = (q["search[value]"] ?? "").toString();
  const orderColIdx = Number(q["order[0][column]"] ?? 0) || 0;
  const orderDir = q["order[0][dir]"] === "asc" ? "ASC" : "DESC";
  const orderExpr =
    DONATION_SORT_COLUMNS[orderColIdx] ?? DONATION_SORT_COLUMNS[0];

  const fromUnix = istDayStartUnix(q.from);
  const toUnix =
    istDayStartUnix(q.to) != null ? (istDayStartUnix(q.to) as number) + 86_400 : null;

  // Total (no filters).
  const totalRow = await c.env.DB.prepare(
    "SELECT COUNT(*) AS c FROM donations",
  ).first<{ c: number }>();
  const recordsTotal = totalRow?.c ?? 0;

  // Filtered count + page.
  const filter = buildDonationFilterClause({
    search,
    status: q.status,
    fromUnix,
    toUnix,
  });
  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) AS c FROM donations ${filter.sql}`,
  )
    .bind(...filter.binds)
    .first<{ c: number }>();
  const recordsFiltered = countRow?.c ?? 0;

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM donations ${filter.sql}
     ORDER BY ${orderExpr} ${orderDir}, id ${orderDir}
     LIMIT ? OFFSET ?`,
  )
    .bind(...filter.binds, length, start)
    .all<Donation>();

  const data = (results ?? []).map((d) => ({
    date: htmlEscape(donationDisplayDate(d)),
    name_email:
      `<div class="font-medium">${htmlEscape(d.buyer_name)}</div>` +
      `<div class="text-xs text-ink/50">${htmlEscape(d.buyer_email)}</div>`,
    amount: `<span class="font-semibold text-maroon-700">₹${d.amount.toLocaleString("en-IN")}</span>`,
    purpose: htmlEscape(d.purpose ?? ""),
    status: statusBadgeHtml(d.status),
    receipt: d.receipt ? htmlEscape(d.receipt) : "—",
    actions: actionsHtml(d),
  }));

  return c.json({ draw, recordsTotal, recordsFiltered, data });
});

// POST /admin/donations/:id/process
// Force-verify against Instamojo, mark Credit, allocate receipt if missing,
// re-send the email. Idempotent. Mirrors PHP plugin's force_update_payment().
adminRoutes.post("/donations/:id/process", async (c) => {
  const id = Number(c.req.param("id"));
  const back = (kind: "ok" | "err", msg: string) =>
    c.redirect(
      `/admin/donations?flash=${kind}&msg=${encodeURIComponent(msg)}`,
    );

  const donation = await c.env.DB.prepare(
    "SELECT * FROM donations WHERE id = ?",
  )
    .bind(id)
    .first<Donation>();
  if (!donation) return back("err", "Donation not found.");

  if (!c.env.INSTAMOJO_CLIENT_ID || !c.env.INSTAMOJO_CLIENT_SECRET) {
    return back("err", "Instamojo credentials not configured.");
  }

  const cfg = {
    clientId: c.env.INSTAMOJO_CLIENT_ID,
    clientSecret: c.env.INSTAMOJO_CLIENT_SECRET,
  };

  // Lazy import to keep admin bundle small? Not necessary on Workers — direct import.
  const { getPaymentDetails, getPaymentRequest, isPaymentCredit } = await import(
    "../instamojo"
  );
  const { allocateReceiptNumber, buildReceiptHtml, ORG } = await import(
    "../donations"
  );
  const { sendEmail } = await import("../brevo");

  // Step 1: get payment_id (derive from payment_request if missing).
  let paymentId = donation.payment_id;
  if (!paymentId) {
    if (!donation.payment_request_id) {
      return back("err", "Donation has no payment_request_id.");
    }
    try {
      const pr = await getPaymentRequest(cfg, donation.payment_request_id);
      const first = pr.payments?.[0];
      if (!first) {
        return back("err", "Instamojo: no payment recorded yet for this request.");
      }
      // first looks like "https://api.instamojo.com/v2/payments/<id>/"
      paymentId = first
        .replace(/^https?:\/\/api\.instamojo\.com\/v2\/payments\//, "")
        .replace(/\/$/, "");
      if (!paymentId) return back("err", "Could not parse payment_id from Instamojo response.");
      console.log(`[donations/${id}/process] derived payment_id=${paymentId}`);
    } catch (err) {
      console.error(`[donations/${id}/process] getPaymentRequest failed`, err);
      return back("err", "Instamojo getPaymentRequest failed (check secrets / tail logs).");
    }
  }

  // Step 2: verify.
  let verify;
  try {
    verify = await getPaymentDetails(cfg, paymentId);
  } catch (err) {
    console.error(`[donations/${id}/process] getPaymentDetails failed`, err);
    return back("err", "Instamojo getPaymentDetails failed.");
  }
  console.log(`[donations/${id}/process] verify.status=${verify.status}`);

  if (!isPaymentCredit(verify)) {
    return back(
      "err",
      `Instamojo says payment not yet credited (status=${String(verify.status ?? "?")}).`,
    );
  }

  // Step 3: mark Credit + capture transaction date.
  let txnUnix: number | null = donation.transaction_date;
  if (!txnUnix && typeof verify.created_at === "string") {
    const t = Date.parse(verify.created_at);
    if (!Number.isNaN(t)) txnUnix = Math.floor(t / 1000);
  }
  await c.env.DB.prepare(
    `UPDATE donations
       SET payment_id = ?, status = 'Credit',
           transaction_date = COALESCE(?, transaction_date)
     WHERE id = ?`,
  )
    .bind(paymentId, txnUnix, id)
    .run();

  // Step 4: allocate receipt if missing.
  let receipt = donation.receipt;
  if (!receipt) {
    receipt = await allocateReceiptNumber(c.env.DB, id);
    console.log(`[donations/${id}/process] allocated receipt=${receipt}`);
  }

  // Step 5: send email (best-effort, but surface errors to admin).
  if (!c.env.BREVO_API_KEY) {
    return back(
      "err",
      `Marked Paid (receipt ${receipt}) but BREVO_API_KEY is not set — email NOT sent.`,
    );
  }

  // Reload row so the email reflects the updated payment_id / txn date / receipt.
  const fresh = await c.env.DB.prepare(
    "SELECT * FROM donations WHERE id = ?",
  )
    .bind(id)
    .first<Donation>();
  if (!fresh) return back("err", "Row vanished after update?");

  try {
    await sendEmail({
      apiKey: c.env.BREVO_API_KEY,
      fromName: ORG.emailFromName,
      fromEmail: ORG.emailFrom,
      toName: fresh.buyer_name,
      toEmail: fresh.buyer_email,
      bccName: ORG.emailFromName,
      bccEmail: ORG.emailBcc,
      subject: ORG.emailSubject,
      htmlContent: buildReceiptHtml(fresh),
    });
  } catch (err) {
    console.error(`[donations/${id}/process] brevo send failed`, err);
    const msg = err instanceof Error ? err.message : String(err);
    return back(
      "err",
      `Marked Paid (receipt ${receipt}). Brevo email failed: ${msg.slice(0, 240)}`,
    );
  }

  return back("ok", `Receipt ${receipt} sent to ${fresh.buyer_email}.`);
});

adminRoutes.get("/donations.csv", async (c) => {
  const q = c.req.query();
  const fromUnix = istDayStartUnix(q.from);
  const toUnix =
    istDayStartUnix(q.to) != null ? (istDayStartUnix(q.to) as number) + 86_400 : null;
  const filter = buildDonationFilterClause({
    search: q.search,
    status: q.status,
    fromUnix,
    toUnix,
  });
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM donations ${filter.sql} ORDER BY created_at DESC`,
  )
    .bind(...filter.binds)
    .all<Donation>();
  const rows = results ?? [];

  const header = [
    "id",
    "created_at",
    "transaction_date",
    "status",
    "amount",
    "currency",
    "purpose",
    "buyer_name",
    "buyer_email",
    "buyer_phone",
    "pan",
    "full_address",
    "payment_request_id",
    "payment_id",
    "receipt",
  ];

  const csvCell = (v: unknown) => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const isoOrEmpty = (u: number | null | undefined) =>
    u ? new Date(u * 1000).toISOString() : "";

  const lines = [header.join(",")];
  for (const d of rows) {
    lines.push(
      [
        d.id,
        isoOrEmpty(d.created_at),
        isoOrEmpty(d.transaction_date),
        d.status,
        d.amount,
        d.currency,
        d.purpose,
        d.buyer_name,
        d.buyer_email,
        d.buyer_phone,
        d.pan,
        d.full_address,
        d.payment_request_id ?? "",
        d.payment_id ?? "",
        d.receipt ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  }

  return new Response(lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="donations-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
});

// ---------------- donation tiers ----------------

async function renderTiersPage(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  opts: { error?: string; editingId?: number } = {},
) {
  const user = c.get("user")!;
  const tiers = await loadDonationTiers(c.env.DB);
  let editing: DonationTier | undefined;
  if (opts.editingId) {
    editing = tiers.find((t) => t.id === opts.editingId);
  }
  return c.html(
    <Layout title="Donation tiers" siteName={c.env.SITE_NAME} user={user}>
      <DonationTiersAdmin tiers={tiers} editing={editing} error={opts.error} />
    </Layout>,
  );
}

adminRoutes.get("/donation-tiers", async (c) => {
  const editParam = c.req.query("edit");
  const editingId = editParam ? Number(editParam) : undefined;
  return renderTiersPage(c, { editingId });
});

adminRoutes.post("/donation-tiers", async (c) => {
  const form = await c.req.parseBody();
  const label = String(form.label ?? "").trim();
  const amount = Number(form.amount);
  const sortOrder = Number(form.sort_order ?? 10);
  if (!label || !Number.isFinite(amount) || amount < 1) {
    return renderTiersPage(c, {
      error: "Label is required and amount must be a positive number.",
    });
  }
  await c.env.DB.prepare(
    "INSERT INTO donation_tiers (label, amount, sort_order) VALUES (?, ?, ?)",
  )
    .bind(label, Math.round(amount), Number.isFinite(sortOrder) ? sortOrder : 10)
    .run();
  return c.redirect("/admin/donation-tiers");
});

adminRoutes.post("/donation-tiers/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const form = await c.req.parseBody();
  const label = String(form.label ?? "").trim();
  const amount = Number(form.amount);
  const sortOrder = Number(form.sort_order ?? 10);
  if (!label || !Number.isFinite(amount) || amount < 1) {
    return renderTiersPage(c, {
      error: "Label is required and amount must be a positive number.",
      editingId: id,
    });
  }
  await c.env.DB.prepare(
    "UPDATE donation_tiers SET label = ?, amount = ?, sort_order = ? WHERE id = ?",
  )
    .bind(label, Math.round(amount), Number.isFinite(sortOrder) ? sortOrder : 10, id)
    .run();
  return c.redirect("/admin/donation-tiers");
});

adminRoutes.post("/donation-tiers/:id/delete", async (c) => {
  const id = Number(c.req.param("id"));
  await c.env.DB.prepare("DELETE FROM donation_tiers WHERE id = ?").bind(id).run();
  return c.redirect("/admin/donation-tiers");
});
