# Cryris Store — Supabase Setup Guide

## New Database Columns (Run in Supabase SQL Editor)

The following SQL adds columns required for the new features (streak bonus, spin tracking).
Run these in your Supabase project under **SQL Editor**. They are safe to re-run (uses `IF NOT EXISTS`).

```sql
-- Daily streak tracking for signed-in users
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS streak_count INT DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_visit_date DATE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS best_streak INT DEFAULT 0;

-- Payment tracking on spin results (for ad-watch / pay modes)
ALTER TABLE spin_results ADD COLUMN IF NOT EXISTS payment_id TEXT;
```

## site_content Keys Used

The following keys are stored in the `site_content` table:

| Key | Description |
|-----|-------------|
| `site_maintenance` | JSON: `{"enabled":bool,"message":"...","reopen_at":"ISO or null"}` |
| `ad_slots` | JSON array of ad slot objects |
| `spin_prizes` | JSON array: `[{"name":"...","emoji":"...","color":"#hex","odds":30}]` |
| `spin_free_mode` | `"1"` = free spins enabled |
| `spin_max_per_day` | Max free spins per user per day |
| `spin_ad_enabled` | `"1"` = watch-ad mode enabled |
| `spin_ad_daily_limit` | Max ad spins per user per day |
| `spin_ad_config` | JSON: `{"enabled":bool,"image_url":"...","link_url":"...","title":"...","duration":5}` |
| `spin_pay_enabled` | `"1"` = pay-to-spin mode enabled |
| `razorpay_payment_link` | Razorpay payment link URL |
| `spin_price` | Display text for spin price (e.g. `₹49`) |

## Default Spin Prizes JSON

```json
[
  {"name": "10% Off",      "emoji": "🏷️", "color": "#00ffd5", "odds": 30},
  {"name": "Free Item",    "emoji": "🎁", "color": "#ff4fd8", "odds": 5},
  {"name": "Try Again",    "emoji": "🔄", "color": "#7c4dff", "odds": 35},
  {"name": "₹50 Off",     "emoji": "💰", "color": "#00ffa8", "odds": 15},
  {"name": "Mystery Prize","emoji": "❓", "color": "#ff3b3b", "odds": 10},
  {"name": "JACKPOT",      "emoji": "👑", "color": "#FFD700", "odds": 5}
]
```

> **Note:** Odds should add up to 100.

## Maintenance Mode

To close the site for maintenance:
1. Go to Admin Dashboard (`#adminonly` → login → `#dashboard`)
2. Under **Site Control**, click "Close Site"
3. Enter a maintenance message and optional reopen date
4. Click "🔴 Close Site"

To reopen:
1. Navigate to the site (you'll see the maintenance overlay)
2. Click the ⚙️ icon at the bottom-right
3. Login with admin credentials
4. In Dashboard → Site Control, click "Reopen Site"

## Ad Slots

Three ad slots are available:
- **header** — Below nav, above hero
- **gallery** — Between gallery items (every 6th item)
- **footer** — Above the footer section

Configure them in Admin Dashboard → **Ad Manager**.
