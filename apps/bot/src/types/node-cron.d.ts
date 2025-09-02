// apps/bot/src/types/node-cron.d.ts
declare module "node-cron" {
  export type ScheduledTask = {
    start: () => void;
    stop: () => void;
    destroy: () => void;
  };

  export function schedule(
    cronExpression: string,
    task: () => void | Promise<void>,
    options?: { scheduled?: boolean; timezone?: string }
  ): ScheduledTask;
}
