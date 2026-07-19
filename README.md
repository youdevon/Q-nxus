# Q-NXUS

HR, payroll, and administration platform for Tobago Urban and Rural Housing Corporation (TURHC).

Remote: https://github.com/youdevon/Q-nxus

## Clone and run

```bash
git clone https://github.com/youdevon/Q-nxus.git
cd Q-nxus
git checkout main
npm install
cp .env.example .env
# Edit .env — set DATABASE_URL and AUTH_SECRET (min 16 chars). Keep .env local; never commit it.
npx prisma migrate deploy
npx prisma generate
npm run seed:access   # optional: access roles
# Optional full demo seed: npx tsx prisma/seed.ts
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Default seeded admin (after seed): `admin@q-nxus.local` / `ChangeMe123!`.

### Checks

```bash
npm run typecheck
npm test
npm run build
```

## Background jobs (ops)

Jobs cover email delivery, correspondence ack reminders, contract expiry, vacation forfeiture, and retention archives.

| Mode | How |
|------|-----|
| On demand | `npm run jobs:run` |
| In-process (15 min) | `ENABLE_BACKGROUND_JOBS=true` in `.env` (see `instrumentation.ts`) |
| External cron | Leave `ENABLE_BACKGROUND_JOBS` unset/false and schedule `npm run jobs:run` |

Single-job scripts also exist (`notify:vacation-forfeiture`, `archive:correspondence-retention`, etc.).

## Contributing

`main` is protected: use a feature branch and open a pull request (force-push and direct pushes to `main` are blocked for admins too).

## Smoke QA (manual)

After migrate/seed on a fresh DB:

1. Sign in as admin
2. Create/activate a contract with vacation off for a short-term person
3. People → Leave → Balances → adjust vacation/sick entitlements
4. People → Leave → Workflow → confirm forfeiture recipients + email toggle
5. Activate a contract and confirm payroll readiness notification or auto-complete when ready

More domain notes live under `docs/`.
