import type { FC } from "hono/jsx";
import type { Event, EventPhoto } from "../types";
import { formatEventDate, shortDate } from "../utils";
import { renderDescription } from "./layout";

function imgUrl(key: string | null | undefined): string | undefined {
  if (!key) return undefined;
  return `/media/${encodeURIComponent(key)}`;
}

export const EventList: FC<{ events: Event[] }> = ({ events }) => {
  if (events.length === 0) {
    return (
      <div class="rounded-xl border border-dashed border-saffron-300 bg-white/60 p-12 text-center text-ink/60">
        No events have been published yet. Check back soon.
      </div>
    );
  }
  const now = Math.floor(Date.now() / 1000);
  const upcoming = events.filter((e) => (e.end_at ?? e.start_at) >= now);
  const past = events.filter((e) => (e.end_at ?? e.start_at) < now);
  return (
    <div class="space-y-14">
      {upcoming.length > 0 && (
        <section>
          <h2 class="mb-6 text-2xl font-semibold text-maroon-700">Upcoming</h2>
          <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((e) => (
              <EventCard event={e} />
            ))}
          </div>
        </section>
      )}
      {past.length > 0 && (
        <section>
          <h2 class="mb-6 text-2xl font-semibold text-maroon-700">Past events</h2>
          <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {past.map((e) => (
              <EventCard event={e} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

const EventCard: FC<{ event: Event }> = ({ event }) => (
  <a
    href={`/events/${event.slug}`}
    class="card group block overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md"
  >
    <div class="aspect-[16/10] w-full overflow-hidden bg-saffron-100">
      {event.hero_r2_key ? (
        <img
          src={imgUrl(event.hero_r2_key)}
          alt={event.title}
          class="h-full w-full object-cover transition group-hover:scale-105"
        />
      ) : (
        <div class="flex h-full w-full items-center justify-center font-display text-5xl text-saffron-500">
          ॐ
        </div>
      )}
    </div>
    <div class="p-5">
      <p class="text-xs font-semibold uppercase tracking-wider text-saffron-700">
        {shortDate(event.start_at)}
      </p>
      <h3 class="mt-1 font-display text-xl font-semibold text-ink">{event.title}</h3>
      {event.location_name && (
        <p class="mt-1 text-sm text-ink/60">{event.location_name}</p>
      )}
      {event.summary && <p class="mt-3 text-sm text-ink/70 line-clamp-3">{event.summary}</p>}
    </div>
  </a>
);

export const EventDetail: FC<{
  event: Event;
  photos: EventPhoto[];
  mapsKey: string;
}> = ({ event, photos, mapsKey }) => {
  const heroUrl = imgUrl(event.hero_r2_key);
  const mapQuery = event.map_query || event.address || event.location_name;
  const hasMap = Boolean(mapQuery);
  const mapSrc = mapsKey
    ? `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(mapsKey)}&q=${encodeURIComponent(mapQuery)}`
    : `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`;
  return (
    <article class="space-y-10">
      <header class="space-y-4">
        <p class="text-sm font-semibold uppercase tracking-wider text-saffron-700">
          {formatEventDate(event.start_at, event.end_at)}
        </p>
        <h1 class="font-display text-4xl font-semibold text-maroon-700 sm:text-5xl">
          {event.title}
        </h1>
        {event.location_name && (
          <p class="text-lg text-ink/70">{event.location_name}</p>
        )}
      </header>

      {heroUrl && (
        <img
          src={heroUrl}
          alt={event.title}
          class="aspect-[16/8] w-full rounded-xl object-cover shadow-sm"
        />
      )}

      {event.summary && (
        <p class="border-l-4 border-saffron-500 pl-4 text-lg italic text-ink/80">
          {event.summary}
        </p>
      )}

      {event.description && (
        <div class="rich-text">{renderDescription(event.description)}</div>
      )}

      {hasMap && (
        <section class="space-y-3">
          <h2 class="text-2xl font-semibold text-maroon-700">Location</h2>
          {event.address && <p class="text-ink/70">{event.address}</p>}
          <div class="overflow-hidden rounded-xl ring-1 ring-saffron-200">
            <iframe
              src={mapSrc}
              class="h-80 w-full"
              loading="lazy"
              referrerpolicy="no-referrer-when-downgrade"
            />
          </div>
        </section>
      )}

      {photos.length > 0 && <Gallery photos={photos} />}
    </article>
  );
};

export const Gallery: FC<{ photos: EventPhoto[] }> = ({ photos }) => (
  <section class="space-y-4">
    <h2 class="text-2xl font-semibold text-maroon-700">Gallery</h2>
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {photos.map((p) => (
        <a
          href={imgUrl(p.r2_key)}
          target="_blank"
          rel="noopener"
          class="group relative block aspect-square overflow-hidden rounded-lg bg-saffron-100 ring-1 ring-saffron-200"
        >
          <img
            src={imgUrl(p.r2_key)}
            alt={p.caption}
            loading="lazy"
            class="h-full w-full object-cover transition group-hover:scale-105"
          />
          {p.caption && (
            <span class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-xs text-white">
              {p.caption}
            </span>
          )}
        </a>
      ))}
    </div>
  </section>
);
