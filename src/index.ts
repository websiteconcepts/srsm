import { Hono } from "hono";
import type { Env, Variables } from "./types";
import { loadUser } from "./auth";
import { publicRoutes } from "./routes/public";
import { adminRoutes } from "./routes/admin";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Attach user (if signed in) to every request.
app.use("*", loadUser);

// Serve uploaded media from R2.
app.get("/media/:key{.+}", async (c) => {
  const key = decodeURIComponent(c.req.param("key"));
  const obj = await c.env.R2.get(key);
  if (!obj) return c.notFound();
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(obj.body, { headers });
});

app.route("/admin", adminRoutes);
app.route("/", publicRoutes);

app.notFound((c) =>
  c.html(
    `<!doctype html><html><head><meta charset="utf-8"><title>Not found</title>
     <link rel="stylesheet" href="/styles.css"></head>
     <body class="min-h-screen bg-cream text-ink flex items-center justify-center">
       <div class="text-center">
         <h1 class="font-display text-5xl text-maroon-700">Not found</h1>
         <p class="mt-2 text-ink/60">We couldn't find that page.</p>
         <a href="/" class="btn-primary mt-6 inline-block">Back home</a>
       </div>
     </body></html>`,
    404,
  ),
);

export default app;
