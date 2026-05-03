# Cyris Portfolio — Supabase Setup Guide

## Schema

Run this SQL in your Supabase **SQL Editor** to create the required tables.

```sql
-- Public content key-value store
CREATE TABLE IF NOT EXISTS site_content (
  id      TEXT PRIMARY KEY,
  content TEXT NOT NULL DEFAULT ''
);

-- Dynamic nav/page sections
CREATE TABLE IF NOT EXISTS site_sections (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT NOT NULL DEFAULT '',
  icon       TEXT NOT NULL DEFAULT '',
  sort_order INT  NOT NULL DEFAULT 0
);

-- Portfolio gallery items
CREATE TABLE IF NOT EXISTS gallery (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT    NOT NULL DEFAULT '',
  description      TEXT    NOT NULL DEFAULT '',
  url              TEXT    NOT NULL DEFAULT '',
  tags             TEXT    NOT NULL DEFAULT '',
  price            TEXT    NOT NULL DEFAULT '',
  category         TEXT    NOT NULL DEFAULT '',
  custom_wa_message TEXT   NOT NULL DEFAULT '',
  additional_media  TEXT   NOT NULL DEFAULT '',
  view_count       INT     NOT NULL DEFAULT 0,
  sold             BOOLEAN NOT NULL DEFAULT FALSE,
  buyer_name       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications shown to site visitors
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message    TEXT    NOT NULL DEFAULT '',
  type       TEXT    NOT NULL DEFAULT 'info',
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Admin role membership (referenced by login flow)
CREATE TABLE IF NOT EXISTS admin_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);
```

## Row-Level Security (RLS)

Enable RLS on every table and apply these policies:

```sql
-- site_content: public read, no public write
ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read site_content"  ON site_content FOR SELECT USING (true);
CREATE POLICY "Service write site_content" ON site_content FOR ALL USING (auth.role() = 'service_role');

-- site_sections: public read, no public write
ALTER TABLE site_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read site_sections"  ON site_sections FOR SELECT USING (true);
CREATE POLICY "Service write site_sections" ON site_sections FOR ALL USING (auth.role() = 'service_role');

-- gallery: public read, no public write
ALTER TABLE gallery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read gallery"  ON gallery FOR SELECT USING (true);
CREATE POLICY "Service write gallery" ON gallery FOR ALL USING (auth.role() = 'service_role');

-- notifications: public read active ones, no public write
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active notifications" ON notifications FOR SELECT USING (active = true);
CREATE POLICY "Service write notifications" ON notifications FOR ALL USING (auth.role() = 'service_role');

-- admin_roles: no public access
ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read own role" ON admin_roles FOR SELECT USING (auth.uid() = user_id);
```

> **Tip:** The admin panel uses the **anon** key but reads/writes via the authenticated session.  
> Grant authenticated users the ability to modify tables by adjusting policies, or use the service role key server-side.

## Admin Setup

### 1. Create admin Supabase Auth user

In Supabase → **Authentication → Users**, create a user with email + password.

### 2. Add user to admin_roles

```sql
INSERT INTO admin_roles (user_id)
VALUES ('<paste-user-uuid-here>');
```

### 3. Set the admin passkey hash

Generate a SHA-256 hash of your chosen passkey string, then store it:

```sql
INSERT INTO site_content (id, content)
VALUES ('admin_passkey_hash', '<sha256-hex-of-your-passkey>');
```

To generate the hash in Node.js:
```js
const crypto = require('crypto');
console.log(crypto.createHash('sha256').update('your-passkey').digest('hex'));
```

### 4. Login flow

Navigate to `#adminonly`. The login form requires:
1. **Email** — Supabase Auth email
2. **Password** — Supabase Auth password
3. **Passkey** — the plaintext passkey (hashed client-side via Web Crypto API and compared to `admin_passkey_hash`)

All three factors must pass for access to be granted.

## site_content Keys

| Key | Description |
|-----|-------------|
| `site_name` | Site/brand name shown in the header |
| `hero_title` | Hero section main title |
| `hero_subtitle` | Hero section subtitle |
| `hero_wallpaper` | URL of the hero background image |
| `logo_url` | URL of the site logo |
| `wa_number` | WhatsApp number (digits only, with country code) |
| `wa_message` | Default WhatsApp pre-fill message |
| `wa_require_login` | `"1"` = require sign-in before WhatsApp (legacy; ignored in simplified schema) |
| `loader_text` | Text shown on the preloader screen |
| `gallery_categories` | Comma-separated list of gallery category names |
| `ui_accent` | CSS hex colour for the accent (e.g. `#00ffd5`) |
| `site_maintenance` | JSON: `{"enabled":bool,"message":"...","reopen_at":"ISO or null"}` |
| `admin_passkey_hash` | SHA-256 hex hash of the admin passkey |
| `view_count` | All-time page view counter |
| `views_today` | Today's view count |
| `views_today_date` | ISO date string for today's views window |

## Maintenance Mode

1. Go to **Admin Dashboard** (`#adminonly` → login → `#dashboard`)
2. Under **Site Control**, click "Close Site"
3. Enter a maintenance message and optional reopen date
4. Click "🔴 Close Site"

To reopen, navigate to the overlay ⚙️ icon → login → Site Control → "Reopen Site".

## Storage Bucket

Create a **public** storage bucket named `assets` in Supabase → Storage.  
All media uploads (logo, wallpaper, gallery items, additional media) are stored there.

