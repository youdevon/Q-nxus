import { archiveExpiredCorrespondenceRetention } from "@/src/modules/hr/services/archive-correspondence-retention";
import { notifyAppraisalDueReminders } from "@/src/modules/hr/services/notify-appraisal-events";
import { notifyContractExpiryReminders } from "@/src/modules/hr/services/notify-contract-expiry";
import { notifyCorrespondenceAcknowledgementReminders } from "@/src/modules/hr/services/notify-correspondence-acknowledgement";
import { notifyLifecycleTaskReminders } from "@/src/modules/hr/services/notify-lifecycle-task-reminders";
import { notifyProbationEndingReminders } from "@/src/modules/hr/services/notify-probation-ending";
import { notifyVacationForfeitureReminders } from "@/src/modules/hr/services/notify-vacation-forfeiture";
import { archiveExpiredStoredFileRetention } from "@/src/modules/hr/services/stored-file-retention";
import {
  processEmailQueue,
  recoverStuckEmailDeliveries,
} from "@/src/modules/notifications/services/process-email-queue";
import { purgeArchivedPriorEmploymentYtd } from "@/src/modules/payroll/services/purge-archived-prior-employment-ytd";
import { notifyGratuityEndingReminders } from "@/src/modules/payroll/services/notify-gratuity-ending";
import { postMonthlyGratuityAccruals } from "@/src/modules/payroll/services/gratuity-accruals";

export type ScheduledJobResult = {
  job: string;
  ok: boolean;
  detail?: unknown;
  error?: string;
};

type ScheduledJob = {
  name: string;
  run: () => Promise<unknown>;
};

const jobs: ScheduledJob[] = [
  {
    name: "process-email-queue",
    run: async () => {
      const recovered = await recoverStuckEmailDeliveries();
      const result = await processEmailQueue(50);
      return { recovered, ...result };
    },
  },
  {
    name: "correspondence-ack-reminders",
    run: () => notifyCorrespondenceAcknowledgementReminders(),
  },
  {
    name: "contract-expiry-reminders",
    run: () => notifyContractExpiryReminders(),
  },
  {
    name: "gratuity-ending-reminders",
    run: () => notifyGratuityEndingReminders(),
  },
  {
    name: "gratuity-monthly-accruals",
    run: () => postMonthlyGratuityAccruals(),
  },
  {
    name: "probation-ending-reminders",
    run: () => notifyProbationEndingReminders(),
  },
  {
    name: "appraisal-due-reminders",
    run: () => notifyAppraisalDueReminders(),
  },
  {
    name: "vacation-forfeiture-reminders",
    run: () => notifyVacationForfeitureReminders(),
  },
  {
    name: "lifecycle-task-reminders",
    run: () => notifyLifecycleTaskReminders(),
  },
  {
    name: "correspondence-retention-archive",
    run: () => archiveExpiredCorrespondenceRetention(),
  },
  {
    name: "stored-file-retention-archive",
    run: () => archiveExpiredStoredFileRetention(),
  },
  {
    name: "prior-employment-archive-purge",
    run: () => purgeArchivedPriorEmploymentYtd(),
  },
];

/**
 * Runs one pass of every scheduled job. Each job is isolated in its own
 * try/catch so a single failure never prevents the remaining jobs from
 * running. Used by `npm run jobs:run` and by the in-app interval scheduler
 * (see instrumentation.ts).
 */
export async function runScheduledJobsOnce(): Promise<ScheduledJobResult[]> {
  const results: ScheduledJobResult[] = [];

  for (const job of jobs) {
    const startedAt = Date.now();

    try {
      const detail = await job.run();
      results.push({ job: job.name, ok: true, detail });
      console.log(
        `[jobs] ${job.name} completed in ${Date.now() - startedAt}ms:`,
        JSON.stringify(detail),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ job: job.name, ok: false, error: message });
      console.error(`[jobs] ${job.name} failed:`, error);
    }
  }

  return results;
}

const JOB_INTERVAL_MS = 15 * 60 * 1000;

// Survives module reloads (dev HMR) so the interval is never registered twice
// within a single server process.
const globalScope = globalThis as typeof globalThis & {
  __qnxusJobSchedulerStarted?: boolean;
};

/**
 * Starts the in-process interval scheduler. Called once per server start from
 * instrumentation.ts when ENABLE_BACKGROUND_JOBS=true. Deployments that run
 * jobs externally (cron calling `npm run jobs:run`) leave the flag unset.
 */
export function startBackgroundJobScheduler(): void {
  if (globalScope.__qnxusJobSchedulerStarted) {
    return;
  }

  globalScope.__qnxusJobSchedulerStarted = true;

  let running = false;

  const tick = async () => {
    if (running) {
      // Previous pass still in flight — skip instead of overlapping.
      return;
    }

    running = true;

    try {
      await runScheduledJobsOnce();
    } finally {
      running = false;
    }
  };

  const interval = setInterval(() => {
    void tick();
  }, JOB_INTERVAL_MS);

  // Never keep the process alive just for the scheduler.
  interval.unref?.();

  console.log(
    `[jobs] Background job scheduler started (every ${JOB_INTERVAL_MS / 60000} minutes).`,
  );
}
