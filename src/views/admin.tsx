import type { FC } from "hono/jsx";
import type { Event, EventPhoto, User } from "../types";
import { formatEventDate, shortDate, unixToDateTimeLocal } from "../utils";
import { FlashError } from "./layout";

function imgUrl(key: string | null | undefined): string | undefined {
  if (!key) return undefined;
  return `/media/${encodeURIComponent(key)}`;
}

export const AdminShell: FC<{
  user: User;
  children: any;
  activeTab?: "events" | "users" | "donations" | "donation-tiers";
}> = ({ children, activeTab = "events" }) => (
  <div class="grid gap-8 md:grid-cols-[220px_1fr]">
    <aside class="space-y-1">
      <h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-ink/50">
        Admin
      </h2>
      <a
        href="/admin"
        class={`block rounded-md px-3 py-2 text-sm ${activeTab === "events" ? "bg-saffron-100 font-semibold text-maroon-700" : "hover:bg-saffron-50"}`}
      >
        Events
      </a>
      <a
        href="/admin/donations"
        class={`block rounded-md px-3 py-2 text-sm ${activeTab === "donations" ? "bg-saffron-100 font-semibold text-maroon-700" : "hover:bg-saffron-50"}`}
      >
        Donations
      </a>
      <a
        href="/admin/donation-tiers"
        class={`block rounded-md px-3 py-2 text-sm ${activeTab === "donation-tiers" ? "bg-saffron-100 font-semibold text-maroon-700" : "hover:bg-saffron-50"}`}
      >
        Donation tiers
      </a>
      <a
        href="/admin/users"
        class={`block rounded-md px-3 py-2 text-sm ${activeTab === "users" ? "bg-saffron-100 font-semibold text-maroon-700" : "hover:bg-saffron-50"}`}
      >
        Users
      </a>
    </aside>
    <div>{children}</div>
  </div>
);

export const LoginForm: FC<{ error?: string; next?: string }> = ({ error, next }) => (
  <div class="mx-auto max-w-sm">
    <h1 class="mb-6 text-center font-display text-3xl font-semibold text-maroon-700">
      Sign in
    </h1>
    <FlashError message={error} />
    <form method="post" action="/admin/login" class="card space-y-4 p-6">
      {next && <input type="hidden" name="next" value={next} />}
      <div>
        <label class="label" for="email">Email</label>
        <input class="input" id="email" name="email" type="email" required autofocus />
      </div>
      <div>
        <label class="label" for="password">Password</label>
        <input class="input" id="password" name="password" type="password" required />
      </div>
      <button class="btn-primary w-full" type="submit">Sign in</button>
    </form>
  </div>
);

export const SetupForm: FC<{ error?: string }> = ({ error }) => (
  <div class="mx-auto max-w-sm">
    <h1 class="mb-2 text-center font-display text-3xl font-semibold text-maroon-700">
      Create owner account
    </h1>
    <p class="mb-6 text-center text-sm text-ink/60">
      No users exist yet. Set up the first admin account.
    </p>
    <FlashError message={error} />
    <form method="post" action="/admin/setup" class="card space-y-4 p-6">
      <div>
        <label class="label" for="name">Name</label>
        <input class="input" id="name" name="name" required />
      </div>
      <div>
        <label class="label" for="email">Email</label>
        <input class="input" id="email" name="email" type="email" required />
      </div>
      <div>
        <label class="label" for="password">Password</label>
        <input class="input" id="password" name="password" type="password" required minlength={8} />
      </div>
      <button class="btn-primary w-full" type="submit">Create account</button>
    </form>
  </div>
);

export const EventsDashboard: FC<{ user: User; events: Event[] }> = ({ user, events }) => (
  <AdminShell user={user} activeTab="events">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="font-display text-3xl font-semibold text-maroon-700">Events</h1>
      <a href="/admin/events/new" class="btn-primary">+ New event</a>
    </div>
    {events.length === 0 ? (
      <div class="rounded-xl border border-dashed border-saffron-300 p-10 text-center text-ink/60">
        No events yet. Create your first one.
      </div>
    ) : (
      <div class="card overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-saffron-50 text-left text-xs uppercase tracking-wider text-ink/60">
            <tr>
              <th class="px-4 py-3">Title</th>
              <th class="px-4 py-3">Date</th>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr class="border-t border-saffron-100">
                <td class="px-4 py-3">
                  <div class="font-medium">{e.title}</div>
                  <div class="text-xs text-ink/50">{e.slug}</div>
                </td>
                <td class="px-4 py-3 text-ink/70">{shortDate(e.start_at)}</td>
                <td class="px-4 py-3">
                  {e.published ? (
                    <span class="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                      Published
                    </span>
                  ) : (
                    <span class="rounded-full bg-ink/10 px-2 py-1 text-xs font-medium text-ink/70">
                      Draft
                    </span>
                  )}
                </td>
                <td class="px-4 py-3 text-right">
                  <a href={`/admin/events/${e.id}`} class="btn-ghost">Edit</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </AdminShell>
);

export const EventForm: FC<{
  user: User;
  event?: Event;
  photos?: EventPhoto[];
  error?: string;
}> = ({ user, event, photos, error }) => {
  const isNew = !event;
  const action = isNew ? "/admin/events" : `/admin/events/${event!.id}`;
  return (
    <AdminShell user={user} activeTab="events">
      <div class="mb-6 flex items-center justify-between">
        <h1 class="font-display text-3xl font-semibold text-maroon-700">
          {isNew ? "New event" : "Edit event"}
        </h1>
        {event && (
          <a
            href={`/events/${event.slug}`}
            target="_blank"
            rel="noopener"
            class="btn-ghost"
          >
            View public page ↗
          </a>
        )}
      </div>
      <FlashError message={error} />

      <form method="post" action={action} enctype="multipart/form-data" class="card space-y-5 p-6">
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="sm:col-span-2">
            <label class="label" for="title">Title</label>
            <input class="input" id="title" name="title" required value={event?.title ?? ""} />
          </div>
          <div class="sm:col-span-2">
            <label class="label" for="slug">
              Slug <span class="text-ink/40">(url path, auto-generated if blank)</span>
            </label>
            <input class="input" id="slug" name="slug" value={event?.slug ?? ""} />
          </div>
          <div>
            <label class="label" for="start_at">Starts (IST)</label>
            <input
              class="input"
              id="start_at"
              name="start_at"
              type="datetime-local"
              required
              value={unixToDateTimeLocal(event?.start_at ?? null)}
            />
          </div>
          <div>
            <label class="label" for="end_at">Ends (optional)</label>
            <input
              class="input"
              id="end_at"
              name="end_at"
              type="datetime-local"
              value={unixToDateTimeLocal(event?.end_at ?? null)}
            />
          </div>
          <div class="sm:col-span-2">
            <label class="label" for="summary">Summary <span class="text-ink/40">(one-line)</span></label>
            <input class="input" id="summary" name="summary" value={event?.summary ?? ""} />
          </div>
          <div class="sm:col-span-2">
            <label class="label" for="description">
              Description <span class="text-ink/40">(HTML allowed — e.g. &lt;h2&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;a&gt;, &lt;strong&gt;, &lt;img&gt;)</span>
            </label>
            <textarea class="input min-h-[200px] font-mono text-sm" id="description" name="description">{event?.description ?? ""}</textarea>
          </div>
          <div>
            <label class="label" for="location_name">Location name</label>
            <input
              class="input"
              id="location_name"
              name="location_name"
              value={event?.location_name ?? ""}
            />
          </div>
          <div>
            <label class="label" for="address">Address</label>
            <input
              class="input"
              id="address"
              name="address"
              value={event?.address ?? ""}
            />
          </div>
          <div class="sm:col-span-2">
            <label class="label" for="map_query">
              Map query <span class="text-ink/40">(optional — overrides address, e.g. "28.6139,77.2090" or "Red Fort, Delhi")</span>
            </label>
            <input
              class="input"
              id="map_query"
              name="map_query"
              value={event?.map_query ?? ""}
            />
          </div>
          <div class="sm:col-span-2">
            <label class="label" for="hero">Hero image</label>
            {event?.hero_r2_key && (
              <img
                src={imgUrl(event.hero_r2_key)}
                alt=""
                class="mb-2 h-32 rounded-md object-cover ring-1 ring-saffron-200"
              />
            )}
            <input class="input" id="hero" name="hero" type="file" accept="image/*" />
          </div>
          <div class="sm:col-span-2">
            <label class="inline-flex items-center gap-2">
              <input
                type="checkbox"
                name="published"
                value="1"
                checked={event ? event.published === 1 : false}
              />
              <span class="text-sm">Published (visible on public site)</span>
            </label>
          </div>
        </div>
        <div class="flex items-center justify-between pt-2">
          <button type="submit" class="btn-primary">
            {isNew ? "Create event" : "Save changes"}
          </button>
        </div>
      </form>

      {event && (
        <>
          <section class="mt-10">
            <h2 class="mb-3 font-display text-2xl font-semibold text-maroon-700">
              Photo gallery
            </h2>
            <p class="mb-4 text-sm text-ink/60">
              Upload post-event photos. Drag is not supported — pick multiple files at once.
            </p>

            <form
              method="post"
              action={`/admin/events/${event.id}/photos`}
              enctype="multipart/form-data"
              class="card mb-6 flex flex-wrap items-end gap-3 p-4"
            >
              <div class="flex-1 min-w-[220px]">
                <label class="label" for="photos">Add photos</label>
                <input
                  class="input"
                  id="photos"
                  name="photos"
                  type="file"
                  accept="image/*"
                  multiple
                  required
                />
              </div>
              <button type="submit" class="btn-primary">Upload</button>
            </form>

            {photos && photos.length > 0 ? (
              <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {photos.map((p) => (
                  <div class="group relative aspect-square overflow-hidden rounded-lg ring-1 ring-saffron-200">
                    <img
                      src={imgUrl(p.r2_key)}
                      alt={p.caption}
                      loading="lazy"
                      class="h-full w-full object-cover"
                    />
                    <form
                      method="post"
                      action={`/admin/photos/${p.id}/delete`}
                      class="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100"
                      onsubmit="return confirm('Delete this photo?')"
                    >
                      <button
                        type="submit"
                        class="rounded-md bg-maroon-600 px-2 py-1 text-xs font-medium text-white"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            ) : (
              <p class="text-sm text-ink/60">No photos yet.</p>
            )}
          </section>

          <section class="mt-12 border-t border-saffron-200 pt-6">
            <form
              method="post"
              action={`/admin/events/${event.id}/delete`}
              onsubmit="return confirm('Delete this event and all its photos? This cannot be undone.')"
            >
              <button type="submit" class="btn-danger">Delete event</button>
            </form>
          </section>
        </>
      )}
    </AdminShell>
  );
};

export const UsersPage: FC<{ user: User; users: User[]; error?: string }> = ({
  user,
  users,
  error,
}) => (
  <AdminShell user={user} activeTab="users">
    <h1 class="mb-6 font-display text-3xl font-semibold text-maroon-700">Users</h1>
    <FlashError message={error} />

    <div class="card mb-8 overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-saffron-50 text-left text-xs uppercase tracking-wider text-ink/60">
          <tr>
            <th class="px-4 py-3">Name</th>
            <th class="px-4 py-3">Email</th>
            <th class="px-4 py-3">Role</th>
            <th class="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr class="border-t border-saffron-100">
              <td class="px-4 py-3">{u.name}</td>
              <td class="px-4 py-3">{u.email}</td>
              <td class="px-4 py-3">{u.role}</td>
              <td class="px-4 py-3 text-right">
                {u.id !== user.id && user.role === "owner" && (
                  <form
                    method="post"
                    action={`/admin/users/${u.id}/delete`}
                    class="inline"
                    onsubmit="return confirm('Delete this user?')"
                  >
                    <button type="submit" class="btn-ghost text-maroon-700">Delete</button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <h2 class="mb-3 font-display text-xl font-semibold text-maroon-700">
      Invite a new user
    </h2>
    <form method="post" action="/admin/users" class="card grid gap-4 p-6 sm:grid-cols-3">
      <div>
        <label class="label" for="new_name">Name</label>
        <input class="input" id="new_name" name="name" required />
      </div>
      <div>
        <label class="label" for="new_email">Email</label>
        <input class="input" id="new_email" name="email" type="email" required />
      </div>
      <div>
        <label class="label" for="new_password">Initial password</label>
        <input class="input" id="new_password" name="password" type="password" required minlength={8} />
      </div>
      <div class="sm:col-span-3">
        <button type="submit" class="btn-primary">Create user</button>
      </div>
    </form>

    <h2 class="mb-3 mt-10 font-display text-xl font-semibold text-maroon-700">
      Change your password
    </h2>
    <form method="post" action="/admin/users/password" class="card grid gap-4 p-6 sm:grid-cols-2">
      <div>
        <label class="label" for="current_password">Current password</label>
        <input class="input" id="current_password" name="current_password" type="password" required />
      </div>
      <div>
        <label class="label" for="new_pw">New password</label>
        <input class="input" id="new_pw" name="new_password" type="password" required minlength={8} />
      </div>
      <div class="sm:col-span-2">
        <button type="submit" class="btn-primary">Update password</button>
      </div>
    </form>
  </AdminShell>
);
