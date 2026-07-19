# Local setup and ops checklist

Companion to the root `README.md`.

## Secrets

- Copy `.env.example` → `.env` only on each machine.
- `.env*` is gitignored; `.env.example` is the only env file that should be committed.
- Never put real SMTP passwords, `AUTH_SECRET`, or production `DATABASE_URL` in git.

## Database

Prisma expects PostgreSQL with schemas `core`, `hr`, `payroll`, `notifications`, and `audit` (created by migrations).

```bash
npx prisma migrate deploy
npx prisma generate
```

## Scheduled jobs

| Job | Purpose |
|-----|---------|
| `process-email-queue` | Send queued notification emails |
| `correspondence-ack-reminders` | Pending letter acknowledgements |
| `contract-expiry-reminders` | Contracts in 30/60/90-day windows |
| `vacation-forfeiture-reminders` | Unused VAC near contract end |
| `correspondence-retention-archive` | Archive expired correspondence |
| `stored-file-retention-archive` | Archive expired stored files |

Run all once: `npm run jobs:run`.

Contract/leave/payroll activate smoke: `npm run smoke:hr` (expects `SMOKE_OK`).

For production, prefer external cron calling `jobs:run` over `ENABLE_BACKGROUND_JOBS=true` unless you intentionally want the Next.js process to own the schedule.
