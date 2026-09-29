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

Checks: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## Deploying to Netlify

Set `DATABASE_URL` (hosted PostgreSQL, e.g. Neon/Supabase, pooled connection) in Netlify site
environment variables and run `npx prisma migrate deploy` against it before first use.
