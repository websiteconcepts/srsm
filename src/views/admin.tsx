import type { FC } from "hono/jsx";
import type { Event, EventPhoto, User } from "../types";
import { formatEventDate, shortDate, unixToDateTimeLocal } from "../utils";
import { FlashError } from "./layout";

function imgUrl(key: string | null | undefined): string | undefined {
  if (!key) return undefined;
  return `/media/${encodeURIComponent(key)}`;
}

// Wraps any full-width admin section with a simple "← Admin" back link.
export const AdminPage: FC<{ children: any }> = ({ children }) => (
  <div>
    <a
      href="/admin"
      class="mb-6 inline-flex items-center gap-2 text-sm text-ink/60 hover:text-maroon-700"
    >
      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
      Admin
    </a>
    <div>{children}</div>
  </div>
);

// Tile used on the admin landing page.
const AdminTile: FC<{
  href: string;
  label: string;
  description: string;
  children: any;
}> = ({ href, label, description, children }) => (
  <a
    href={href}
    class="card group flex items-center gap-5 p-6 transition hover:-translate-y-0.5 hover:shadow-md"
  >
    <span class="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-saffron-100 text-saffron-700 transition group-hover:bg-saffron-200 group-hover:text-maroon-700">
      {children}
    </span>
    <span>
      <span class="block font-display text-xl font-semibold text-maroon-700">{label}</span>
      <span class="text-sm text-ink/60">{description}</span>
    </span>
  </a>
);

const ICON = {
  calendar: (
    <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  heart: (
    <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
        d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 010-6.364z" />
    </svg>
  ),
  users: (
    <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
        d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-5.13a4 4 0 11-8 0 4 4 0 018 0zm6 0a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  cog: (
    <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

export const AdminHome: FC<{ user: User }> = ({ user }) => (
  <div class="mx-auto max-w-4xl">
    <header class="mb-10 text-center">
      <h1 class="font-display text-4xl font-semibold text-maroon-700">Admin</h1>
      <p class="mt-2 text-ink/60">Welcome back, {user.name}.</p>
    </header>
    <div class="grid gap-5 sm:grid-cols-2">
      <AdminTile href="/admin/events" label="Events" description="Create and edit events">
        {ICON.calendar}
      </AdminTile>
      <AdminTile href="/admin/donations" label="Donations" description="View, filter, resend receipts">
        {ICON.heart}
      </AdminTile>
      <AdminTile href="/admin/users" label="Users" description="Manage admin accounts">
        {ICON.users}
      </AdminTile>
      <AdminTile href="/admin/settings" label="Settings" description="Donation tiers and configuration">
        {ICON.cog}
      </AdminTile>
    </div>
  </div>
);

const SettingsLink: FC<{
  href: string;
  label: string;
  description: string;
}> = ({ href, label, description }) => (
  <a
    href={href}
    class="card flex items-center justify-between p-5 transition hover:bg-saffron-50"
  >
    <span>
      <span class="block font-display text-lg font-semibold text-maroon-700">{label}</span>
      <span class="text-sm text-ink/60">{description}</span>
    </span>
    <span aria-hidden="true" class="text-saffron-700">→</span>
  </a>
);

export const AdminSettings: FC = () => (
  <AdminPage>
    <h1 class="mb-6 font-display text-3xl font-semibold text-maroon-700">Settings</h1>
    <div class="space-y-3">
      <SettingsLink
        href="/admin/donation-tiers"
        label="Donation tiers"
        description="Configure the predefined donation amounts shown on the donate page."
      />
    </div>
  </AdminPage>
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
  <AdminPage>
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
  </AdminPage>
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
    <AdminPage>
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
            <p class="mt-1 text-xs text-ink/50">
              Shortcodes: <code class="rounded bg-saffron-100 px-1">[donate]</code> embeds the live donation form (uses current tiers).
            </p>
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
    </AdminPage>
  );
};

export const UsersPage: FC<{ user: User; users: User[]; error?: string }> = ({
  user,
  users,
  error,
}) => (
  <AdminPage>
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
  </AdminPage>
);
