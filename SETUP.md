# Cyris — Supabase Setup Guide

## 1. Required Database Columns (Run in Supabase SQL Editor)

Run the following SQL in your Supabase project under **SQL Editor**. Safe to re-run (`IF NOT EXISTS`).

```sql
-- Daily streak tracking for signed-in users
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS streak_count INT DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_visit_date DATE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS best_streak INT DEFAULT 0;

-- Admin flag on user profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
```

## 2. Admin Setup

### Create the admin user in Supabase Auth
1. Go to **Supabase Dashboard → Authentication → Users**
2. Click **"Add User"** and create your admin account
3. After creation, find the user's UUID

### Mark the user as admin in the database
```sql
UPDATE user_profiles SET is_admin = TRUE WHERE email = 'your-admin@example.com';
```

### Set the admin passkey hash
The login form requires a passkey in addition to email/password. Store the **SHA-256 hash** of your passkey in `site_content`:

```sql
-- Replace <SHA256_HEX> with the SHA-256 hex digest of your passkey
INSERT INTO site_content (id, content)
VALUES ('admin_passkey_hash', '<SHA256_HEX>')
ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content;
```

**How to compute the SHA-256 hex of your passkey:**
- Open browser DevTools console and run:
```js
(async () => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('YOUR_PASSKEY'));
  console.log(Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join(''));
})();
```
- Copy the output and use it as `<SHA256_HEX>` above.

> **Security notes:**
> - The passkey is never stored in code. Only its hash is stored in Supabase.
> - Admin access requires **both** valid Supabase Auth credentials **and** the correct passkey **and** `is_admin = TRUE` in `user_profiles`.
> - The `admin_passkey_hash` row should be protected by a Supabase RLS policy that allows only authenticated users to read it.

## 3. site_content Keys Used

| Key | Description |
|-----|-------------|
| `site_maintenance` | JSON: `{"enabled":bool,"message":"...","reopen_at":"ISO or null"}` |
| `admin_passkey_hash` | SHA-256 hex of the admin passkey |
| `site_name` | Site/brand display name |
| `hero_title` | Hero section main title |
| `hero_subtitle` | Hero section subtitle |
| `hero_bg` | Hero background image URL |
| `logo_url` | Logo image URL |
| `instagram` | Instagram profile URL |
| `youtube` | YouTube channel URL |
| `whatsapp` | WhatsApp footer link URL |
| `email` | Contact email address |
| `whatsapp_phone` | WhatsApp phone number (digits only) |
| `whatsapp_template` | WhatsApp message template |
| `loader_word1` / `loader_word2` | Preloader animated words |
| `loader_color1` / `loader_color2` | Preloader word colours |
| `ui_enable_lightbox_nav` | `"1"` = lightbox prev/next enabled |
| `ui_enable_watermark` | `"1"` = watermark enabled |
| `ui_watermark_text` | Watermark text |
| `ui_watermark_opacity` | Watermark opacity (0.05–0.4) |
| `gallery_categories` | Comma-separated category list |
| `new_badge_days` | Days a gallery item is marked "NEW" |
| `view_count` | Total page view counter |
| `views_today` | Views today counter |
| `views_today_date` | Date string for today's view counter |

## 4. Maintenance Mode

1. Go to Admin Dashboard (`#adminonly` → login → `#dashboard`)
2. Under **Site Control**, click "Close Site"
3. Enter a maintenance message and optional reopen date
4. Click "🔴 Close Site"

To reopen, navigate to the site while it's in maintenance, click the ⚙️ icon at the bottom-right, log in as admin, then click "Reopen Site" in the Dashboard.

## 5. Recommended Supabase RLS Policies

To protect admin data, add a policy on `site_content` that restricts reads of `admin_passkey_hash` to authenticated users only:

```sql
-- Allow anon to read all site_content except admin_passkey_hash
CREATE POLICY "public_read_site_content" ON site_content
  FOR SELECT USING (id != 'admin_passkey_hash');

-- Allow authenticated users (admins) to read all site_content
CREATE POLICY "authed_read_site_content" ON site_content
  FOR SELECT TO authenticated USING (true);

-- Allow authenticated admins to modify site_content
CREATE POLICY "admin_write_site_content" ON site_content
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = TRUE
  ));
```

