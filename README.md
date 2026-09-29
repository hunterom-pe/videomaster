# VideoMaster — Video Rental Management System v1.0

Browser-based (Next.js / React / TypeScript) 1990s-style video rental store software.
Spec: `docs/videomaster_spec.md`. Dev rules: `CLAUDE.md`. Status: `PROGRESS.md`.

## Local development

```bash
cp .env.example .env          # set DATABASE_URL to a PostgreSQL database
npm install                   # also runs `prisma generate`
npx prisma migrate deploy     # apply migrations (use `migrate dev` while changing the schema)
npm run dev                   # http://localhost:3000
```

**After pulling changes or changing `prisma/schema.prisma`:** run `npx prisma migrate deploy`, then **restart** `npm run dev` (it regenerates the Prisma client on start; a running dev server keeps the old client and will show "This page couldn't load").

**Demo data:** on first-run setup tick *Load sample store data*, or use *Store Settings → Load sample store data* on an empty store (28 classic movies, customers, merchandise and 3 weeks of history). `node scripts/fetch-sample-titles.mjs` regenerates the movie metadata file from TMDB (needs a TMDB key in `.env`).

**Time zone:** set per store in Store Settings (defaults from your browser; Arizona = `America/Phoenix`, no daylight saving). It decides when "today" starts for due dates, late fees, overdue and reports.

Checks: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. `npm run test:db` runs the database integration test against a spare `videomaster_test` database (created once with `createdb videomaster_test`).

## Deploying to Netlify

1. **Database:** create a hosted PostgreSQL database (e.g. Neon or Supabase).
2. **Site:** in Netlify choose *Add new site → Import from Git* and select this repo.
   `netlify.toml` already sets the build command and Node version.
3. **Environment variables** (Site configuration → Environment variables):
   - `DATABASE_URL` — the host's pooled connection string (used by the running app).
   - `MIGRATE_DATABASE_URL` — the direct (non-pooled) connection string (used for migrations).
4. Deploy. Production builds run `prisma migrate deploy` automatically before `next build`.
   Deploy previews do not run migrations.

Later milestones add `TMDB_API_KEY` (server-side only).
