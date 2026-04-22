import { Hono } from "hono";
import type { Env, Event, EventPhoto, Variables } from "../types";
import { Layout, Hero } from "../views/layout";
import { EventList, EventDetail } from "../views/public";
import { HighlightsPage } from "../views/highlights";

// Public Google Drive folders whose images drive the /highlights page.
// Keyed by short slug; the client sends ?event=<slug>.
const HIGHLIGHTS_FOLDERS: Record<string, string> = {
  goa: "191KWfX30I4Hxce68HlMgKv5Y2VtTAxJq",
  delhi: "1c6dDSBhVQz9axuL1F5UZDF8qoePuOPoh",
};
const HIGHLIGHTS_MAX_IMAGES = 500;
const HIGHLIGHTS_CACHE_SECONDS = 300;

export const publicRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

publicRoutes.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM events WHERE published = 1 ORDER BY start_at DESC",
  ).all<Event>();
  return c.html(
    <Layout
      title="Events"
      siteName={c.env.SITE_NAME}
      user={c.get("user")}
      hero={<Hero title={c.env.SITE_NAME} tagline={c.env.SITE_TAGLINE} />}
    >
      <EventList events={results ?? []} />
    </Layout>,
  );
});

publicRoutes.get("/highlights", async (c) => {
  return c.html(
    <Layout title="Highlights" siteName={c.env.SITE_NAME} user={c.get("user")} richContent>
      <HighlightsPage />
    </Layout>,
  );
});

publicRoutes.get("/api/highlights", async (c) => {
  const apiKey = c.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey) {
    return c.json({ error: "GOOGLE_DRIVE_API_KEY not configured" }, 500);
  }

  const eventKey = (c.req.query("event") ?? "goa").toLowerCase();
  const folderId = HIGHLIGHTS_FOLDERS[eventKey];
  if (!folderId) {
    return c.json({ error: `Unknown event '${eventKey}'` }, 400);
  }

  const cache = (caches as unknown as { default: Cache }).default;
  const cacheUrl = new URL(c.req.url);
  cacheUrl.search = `?event=${encodeURIComponent(eventKey)}`;
  const cacheKey = new Request(cacheUrl.toString());
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const query =
    `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`;
  const driveUrl =
    `https://www.googleapis.com/drive/v3/files` +
    `?q=${encodeURIComponent(query)}` +
    `&orderBy=createdTime desc` +
    `&pageSize=${HIGHLIGHTS_MAX_IMAGES}` +
    `&fields=files(id,name,thumbnailLink,createdTime)` +
    `&key=${encodeURIComponent(apiKey)}`;

  const driveRes = await fetch(driveUrl);
  const body = await driveRes.text();
  if (!driveRes.ok) {
    return c.json({ error: "Drive API error", status: driveRes.status, detail: body }, 502);
  }

  const response = new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": `public, max-age=${HIGHLIGHTS_CACHE_SECONDS}`,
    },
  });
  c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
});

publicRoutes.get("/events/:slug", async (c) => {
  const slug = c.req.param("slug");
  const event = await c.env.DB.prepare(
    "SELECT * FROM events WHERE slug = ? AND published = 1",
  )
    .bind(slug)
    .first<Event>();
  if (!event) return c.notFound();
  const { results: photos } = await c.env.DB.prepare(
    "SELECT * FROM event_photos WHERE event_id = ? ORDER BY sort_order, id",
  )
    .bind(event.id)
    .all<EventPhoto>();
  return c.html(
    <Layout
      title={event.title}
      siteName={c.env.SITE_NAME}
      user={c.get("user")}
      richContent
    >
      <EventDetail
        event={event}
        photos={photos ?? []}
        mapsKey={c.env.GOOGLE_MAPS_EMBED_KEY || ""}
      />
    </Layout>,
  );
});
