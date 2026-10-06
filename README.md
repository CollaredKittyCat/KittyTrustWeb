# Freelance Review Board

A custom website for publishing **first-hand reviews of freelancers you've personally worked
with** — their banner, links, stars, and the full story — plus a password-protected staff
dashboard to add, edit, and remove them. Backed by PostgreSQL and pre-configured to deploy on
[Railway](https://railway.app) as-is.

## Features

**Public site (`/`)**
- Review cards showing the freelancer's **banner image (loaded from a link you provide)**
- **1–5 star rating** displayed on every card, plus the site-wide average
- Fields: **display name, username, Discord user ID, user link, service, experience**
- Search by name, username, service, or identifier (`/?q=…`)
- "View profile" button opens their user link
- Broken banner links fall back to a placeholder automatically

**Staff dashboard (`/dashboard`, password protected)**
- **Add** a review (interactive star picker + live banner preview)
- **Edit** any review (form pre-filled)
- **Remove** a review by typing its **identifier** (or row ID) — or use the Remove button
- Each review has an identifier you choose (e.g. `jane-doe`) used to find/remove it later
- Server-side validation: stars must be 1–5, links must be http(s), Discord ID must be numeric,
  identifiers must be unique (case-insensitive)

## Stack

Node.js · Express · EJS templates · `pg` (node-postgres) · PostgreSQL

## Local development

```bash
npm install
cp .env.example .env          # then edit DATABASE_URL / STAFF_PASSWORD
createdb freelancer_reviews   # or let DATABASE_URL point at an existing DB
npm run db:push               # creates the reviews table (also runs automatically on boot)
npm run dev                   # http://localhost:3000
```

## Deploying on Railway

The database wiring is already filled in — Railway's `DATABASE_URL` is read automatically,
TLS is enabled for non-local hosts, and `PORT` is respected.

1. Push this repository to GitHub.
2. In Railway: **New Project → Deploy from GitHub repo** (railway.json supplies the build and
   start commands: `npm ci` / `npm start`, health check on `/`).
3. In your project, **+ Plugin → PostgreSQL**. Railway injects `DATABASE_URL` (and `PG*`)
   into the service automatically — no manual connection settings needed. The `reviews`
   table is created on first boot, so no migration step is required.
4. Under **Variables**, set:

   | Variable        | Required | Purpose                                            |
   | --------------- | -------- | -------------------------------------------------- |
   | `DATABASE_URL`  | auto     | Filled in by the PostgreSQL plugin (don't set it)  |
   | `STAFF_PASSWORD`| **yes**  | Password for the `/dashboard` login                |
   | `SESSION_SECRET`| **yes**  | Signs login cookies — `openssl rand -hex 32`       |
   | `SITE_NAME`     | no       | Brand shown in the header (default: Freelance Reviews) |
   | `PORT`          | auto     | Assigned by Railway (don't set it)                 |

5. Deploy and open the service URL → sign in at `/login` → start publishing reviews.

> If `STAFF_PASSWORD` is unset the dashboard password falls back to `changeme` and a warning
> is logged. Always set it in production.

## Environment variables

Copy `.env.example` to `.env` for local runs. Every variable:

```
DATABASE_URL=postgres://postgres@localhost:5432/freelancer_reviews
PORT=3000
STAFF_PASSWORD=change-me
SESSION_SECRET=
SITE_NAME=Freelance Reviews
```

## Project layout

```
src/
  server.js            Express app, view helpers, error pages, startup
  db.js                Pool from DATABASE_URL/PG*, SSL handling, auto schema
  auth.js              Staff login cookie (HMAC-signed) + middleware
  validate.js          Review form validation
  routes/site.js       Public homepage (list, search, stats)
  routes/dashboard.js  Login/logout + add/edit/remove
views/                 EJS templates (partials, home, dashboard, forms)
public/                styles.css, app.js, favicon.svg
```

## Removing a review

Dashboard → **Remove a review** → type the identifier (e.g. `jane-doe`) → Remove.
Identifiers are matched case-insensitively, and the numeric row ID also works.
