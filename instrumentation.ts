/**
 * Next.js instrumentation — `register` runs once per server start.
 *
 * When ENABLE_BACKGROUND_JOBS=true, an in-process interval runs the scheduled
 * jobs (email queue, correspondence ack reminders, contract expiry reminders,
 * vacation forfeiture, retention archive) every 15 minutes. Defaults to OFF so
 * each deployment opts in explicitly; deployments with external cron should
 * leave it unset and run `npm run jobs:run` instead.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  if (process.env.ENABLE_BACKGROUND_JOBS !== "true") {
    return;
  }

  const { startBackgroundJobScheduler } = await import(
    "@/src/modules/jobs/scheduled-jobs"
  );

  startBackgroundJobScheduler();
}
