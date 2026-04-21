import { Hono } from "hono";
import type { Env, Event, EventPhoto, User, Variables } from "../types";
import { Layout } from "../views/layout";
import {
  EventForm,
  EventsDashboard,
  LoginForm,
  SetupForm,
  UsersPage,
} from "../views/admin";
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

// Dashboard
adminRoutes.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM events ORDER BY start_at DESC",
  ).all<Event>();
  return c.html(
    <Layout title="Admin" siteName={c.env.SITE_NAME} user={c.get("user")}>
      <EventsDashboard user={c.get("user")!} events={results ?? []} />
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
  return c.redirect("/admin");
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
