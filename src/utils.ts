export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function formatEventDate(startAt: number, endAt: number | null): string {
  const start = new Date(startAt * 1000);
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  };
  const startStr = start.toLocaleString("en-IN", opts);
  if (!endAt) return startStr;
  const end = new Date(endAt * 1000);
  const sameDay = start.toDateString() === end.toDateString();
  const endStr = end.toLocaleString("en-IN", sameDay
    ? { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }
    : opts);
  return `${startStr} — ${endStr}`;
}

export function shortDate(startAt: number): string {
  return new Date(startAt * 1000).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

export function parseDateTimeLocalToUnix(v: string | null | undefined): number | null {
  if (!v) return null;
  // <input type="datetime-local"> returns "YYYY-MM-DDTHH:mm". Treat as Asia/Kolkata.
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  // Construct UTC timestamp for that wall-clock time at IST (UTC+5:30).
  const utcMs = Date.UTC(+y, +mo - 1, +d, +h, +mi) - (5 * 60 + 30) * 60_000;
  return Math.floor(utcMs / 1000);
}

export function unixToDateTimeLocal(unix: number | null): string {
  if (!unix) return "";
  const d = new Date(unix * 1000 + (5 * 60 + 30) * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
