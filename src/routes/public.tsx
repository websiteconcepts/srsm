import { Hono } from "hono";
import type { Env, Event, EventPhoto, Variables } from "../types";
import { Layout, Hero } from "../views/layout";
import { EventList, EventDetail } from "../views/public";

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
