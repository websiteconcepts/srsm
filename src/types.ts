export type Env = {
  DB: D1Database;
  R2: R2Bucket;
  ASSETS: Fetcher;
  SITE_NAME: string;
  SITE_TAGLINE: string;
  GOOGLE_MAPS_EMBED_KEY: string;
  GOOGLE_DRIVE_API_KEY: string;
};

export type User = {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  role: "admin" | "owner";
  created_at: number;
};

export type Event = {
  id: number;
  slug: string;
  title: string;
  summary: string;
  description: string;
  start_at: number;
  end_at: number | null;
  location_name: string;
  address: string;
  map_query: string;
  hero_r2_key: string | null;
  published: number;
  created_by: number | null;
  created_at: number;
  updated_at: number;
};

export type EventPhoto = {
  id: number;
  event_id: number;
  r2_key: string;
  caption: string;
  sort_order: number;
  uploaded_by: number | null;
  uploaded_at: number;
};

export type Variables = {
  user?: User;
};
