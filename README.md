# Royal College Hockey Archives

A free website for the full history of Royal College hockey, covering players, teams from U9 to the 1st XI, matches, scorelines, venues and honours. It includes a network graph and a timeline.

- **Website:** React + Vite, hosted free on GitHub Pages
- **Database:** Supabase (free tier). Anyone can read the public data. Only approved editors can add data, and contact details are visible only to signed-in members.
- **Demo mode:** with no Supabase connected, the site runs on sample data, so you can try it straight away.

## Pages

| Page | What it shows |
|---|---|
| Players | Search and filters (colours, captains, other sports) |
| Player profile | Journey chart across age groups and years, teams, honours, goals, teammates, private contact |
| Teams | Grid of every age group by season |
| Team page | Squad, captain, honours, fixtures and results with W/D/L, top scorers, links to previous and next season |
| Match page | Score, scorers, line-up, venue, source |
| Opponent / venue page | Head-to-head record across all years and age groups |
| Network | Interactive force-directed graph with year range, honour and opponent toggles, and search |
| Timeline | Age-group lanes by season, plus a season-by-season list |
| Submit info | Public form for anyone to send a player, team, match, honour or correction. It's saved for review and emailed to the admin. |
| Admin (`#/admin`, not in the menu) | Review submissions (approve or reject), plus forms to add entries to the archive |

## Setup (about 20 minutes, all free)

### 1. Create the database
1. Sign up at [supabase.com](https://supabase.com) and create a new project. Choose the Singapore or Mumbai region, as they're closest to Sri Lanka.
2. Open **SQL Editor**, paste in `supabase/schema.sql`, and click **Run**.
3. Do the same with `supabase/seed.sql`. This adds the first real entries: Roshan, Thisila Herath and Rohana Jayawickrama.
4. Under **Authentication → URL configuration**, set the Site URL to your GitHub Pages address (from step 2).

### 1b. Submissions and email
1. In the SQL Editor, also run `supabase/submissions.sql`.
2. Get a free access key at [web3forms.com](https://web3forms.com), using the admin email address. Submissions are emailed there.
3. Add it as a GitHub secret named `VITE_WEB3FORMS_KEY` (see step 2).

### 1c. Crest
Put the white Royal College crest at `public/crest.png` (a transparent PNG, about 128 px tall). It's used in the header and as the browser tab icon.

### 2. Put the site on GitHub
1. Create a GitHub repo (e.g. `royal-hockey-archive`) and push this folder to it.
2. In the repo, go to **Settings → Secrets and variables → Actions** and add two secrets, using the values from Supabase **Project Settings → API**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` (the *publishable* key, `sb_publishable_…`; it's safe to use in a website)
   - `VITE_WEB3FORMS_KEY`
3. Go to **Settings → Pages** and set Source to **GitHub Actions**.
4. Push to `main`. The site will be live at `https://YOUR-USERNAME.github.io/royal-hockey-archive/`.

### 3. Add admins
1. The admin opens `…/#/admin` on the site and signs in with their email (they get a one-time link).
2. In Supabase, go to **Table editor → auth.users** and copy their user id.
3. In **Table editor → members**, add a row with that `user_id`, their name, and `is_editor = true`. To make someone a member who can see contacts but not edit, leave `is_editor = false`.

## Run on your computer

```bash
npm install
cp .env.example .env.local   # optional: leave it out to use demo mode
npm run dev
```

## Notes

- **Privacy:** only add a phone number or email with the person's permission, and tick the consent box when you do. This is required under Sri Lanka's Personal Data Protection Act. Members only see contacts where consent is ticked.
- **Sources:** fill in the `source` field (e.g. "Daily News, 12 Mar 1989", or "Shihar Sir, WhatsApp") so facts can be checked later.
- **Incomplete records are fine:** a match can be just a date and a score at first, with scorers, line-ups and venues added later.
- **Free Supabase projects pause after about a week with no visits.** If that happens, click **Restore** in the Supabase dashboard. Regular use keeps it awake.
- **Changing the data model:** the tables are in `supabase/schema.sql`. Every page reads from `src/data/db.js`.
