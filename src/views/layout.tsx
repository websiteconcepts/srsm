import type { Child, FC } from "hono/jsx";
import { raw } from "hono/html";
import type { User } from "../types";

type LayoutProps = {
  title: string;
  siteName: string;
  user?: User;
  children: Child;
  hero?: Child;
  richContent?: boolean;
};

export const Layout: FC<LayoutProps> = ({
  title,
  siteName,
  user,
  children,
  hero,
  richContent,
}) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>
        {title} · {siteName}
      </title>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600&display=swap"
        rel="stylesheet"
      />
      <link rel="stylesheet" href="/styles.css" />
      {richContent &&
        raw(`<script src="https://cdn.tailwindcss.com"></script>
<script>
  tailwind.config = {
    theme: {
      extend: {
        colors: {
          saffron: { 500: '#FF9933', 600: '#E8801A', 700: '#B85F10' },
          maroon:  { 500: '#A82121', 600: '#8B1A1A', 700: '#6E1414' },
          cream:   '#FFF8EC',
          ink:     '#2C1810',
        },
        fontFamily: {
          display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        },
      },
    },
  };
</script>`)}
      <meta name="theme-color" content="#FF9933" />
    </head>
    <body class="min-h-screen bg-cream text-ink">
      <SiteHeader siteName={siteName} user={user} />
      {hero}
      <main class="mx-auto w-full max-w-6xl px-4 py-10">{children}</main>
      <SiteFooter siteName={siteName} />
    </body>
  </html>
);

const SiteHeader: FC<{ siteName: string; user?: User }> = ({ siteName, user }) => (
  <header class="border-b border-saffron-200 bg-white/70 backdrop-blur">
    <div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
      <a href="/" class="flex items-center gap-3">
        <span class="inline-flex items-center justify-center font-display text-lg font-bold text-white">
          <img src="https://pub-94c133657de142ba98ab238bbedc18fa.r2.dev/LogoSRSM_PNG.png"
          style="height:81px" />
        </span>
        <span class="font-display text-lg font-semibold tracking-tight">{siteName}</span>
      </a>
      <nav class="flex items-center gap-1 text-sm font-medium sm:gap-2">
        <a
          href="/highlights"
          class="rounded-md px-3 py-2 text-ink/80 transition hover:bg-saffron-100 hover:text-maroon-700"
        >
          Highlights
        </a>
        {user && (
          <a
            href="/admin"
            class="rounded-md px-3 py-2 text-ink/80 transition hover:bg-saffron-100 hover:text-maroon-700"
          >
            Admin
          </a>
        )}
      </nav>
    </div>
  </header>
);

const SiteFooter: FC<{ siteName: string }> = ({ siteName }) => (
  <footer class="mt-20 border-t border-saffron-200 bg-white/60">
    <div class="mx-auto max-w-6xl px-4 py-8 text-center text-sm text-ink/60">
      © {new Date().getFullYear()} {siteName}
    </div>
  </footer>
);

export const Hero: FC<{ title: string; tagline: string; imageUrl?: string }> = ({
  title,
  tagline,
  imageUrl,
}) => (
  <section class="relative overflow-hidden border-b border-saffron-200 bg-gradient-to-br from-saffron-100 via-cream to-saffron-200">
    {imageUrl && (
      <img
        src={imageUrl}
        alt=""
        class="absolute inset-0 h-full w-full object-cover opacity-30"
      />
    )}
    <div class="relative mx-auto max-w-6xl px-4 py-16 text-center sm:py-24">
      <h1 class="font-display text-4xl font-semibold text-maroon-700 sm:text-6xl">{title}</h1>
      <p class="mt-4 text-lg text-ink/70 sm:text-xl">{tagline}</p>
    </div>
  </section>
);

export const FlashError: FC<{ message?: string }> = ({ message }) =>
  message ? (
    <div class="mb-4 rounded-md border border-maroon-600/20 bg-maroon-600/10 px-4 py-3 text-sm text-maroon-700">
      {message}
    </div>
  ) : null;

// Admin-authored HTML is trusted and rendered as-is.
export function renderDescription(html: string) {
  return raw(html);
}
