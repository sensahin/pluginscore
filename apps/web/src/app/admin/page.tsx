import {
  Activity,
  Clock3,
  Database,
  Gauge,
  ShieldCheck,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getHealth, getQueue, getStats } from "@/lib/api";

export const metadata = {
  title: "Admin",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminPage() {
  const [health, stats, queueJobs] = await Promise.all([
    getHealth(),
    getStats(),
    getQueue(20),
  ]);
  const metrics = [
    { label: "Indexed plugins", value: stats.indexedPlugins.toLocaleString(), detail: "metadata rows" },
    { label: "Audited plugins", value: (stats.auditedPlugins ?? stats.completedScans).toLocaleString(), detail: "unique plugins" },
    { label: "Completed audits", value: stats.completedScans.toLocaleString(), detail: "stored scan history" },
    { label: "Queued jobs", value: stats.queuedJobs.toLocaleString(), detail: "waiting to scan" },
    { label: "Running scans", value: stats.runningJobs.toLocaleString(), detail: "active workers" },
    { label: "Failed jobs", value: stats.failedJobs.toLocaleString(), detail: "needs operator check" },
    { label: "Open issue codes", value: stats.issueCodes.toLocaleString(), detail: "deduped taxonomy" },
  ];

  return (
    <AppShell>
      <section className="rounded-md border border-line bg-surface p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-medium text-brand">Admin</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal">
              PluginScore Operations
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
              Private audit, queue, and backend health snapshot for the scan pipeline.
            </p>
          </div>
          <div className="rounded-md border border-line bg-background px-3 py-2 text-sm">
            <span className="inline-flex items-center gap-2 font-medium">
              <ShieldCheck size={16} aria-hidden="true" />
              Basic auth
            </span>
          </div>
        </div>
      </section>

      <section className="rounded-md border border-line bg-surface p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-brand">Audit overview</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-normal">
              Scan index snapshot
            </h2>
          </div>
          <Gauge size={20} className="text-muted" aria-hidden="true" />
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-md border border-line bg-background p-4"
            >
              <p className="text-xs font-medium uppercase text-muted">
                {metric.label}
              </p>
              <p className="mt-2 font-mono text-3xl font-semibold">
                {metric.value}
              </p>
              <p className="mt-1 text-xs text-muted">{metric.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <aside className="rounded-md border border-line bg-surface p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Backend Health</h2>
            <Activity size={18} className="text-muted" aria-hidden="true" />
          </div>
          <div className="mt-4 divide-y divide-line text-sm">
            <Meta label="API URL" value={health.apiUrl ?? "sample data"} />
            <Meta label="Status" value={health.ok ? "ok" : "fallback"} />
            <Meta label="Mode" value={health.mode ?? "sample"} />
          </div>
        </aside>

        <section className="rounded-md border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line p-5">
            <h2 className="text-base font-semibold">Worker Queue</h2>
            <Clock3 size={18} className="text-muted" aria-hidden="true" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase text-muted">
                  <th className="px-5 py-3 font-semibold">Plugin</th>
                  <th className="px-5 py-3 font-semibold">Version</th>
                  <th className="px-5 py-3 font-semibold">State</th>
                  <th className="px-5 py-3 font-semibold">Reason</th>
                  <th className="px-5 py-3 text-right font-semibold">Runtime</th>
                </tr>
              </thead>
              <tbody>
                {queueJobs.map((job) => (
                  <tr
                    key={`${job.plugin}-${job.version}-${job.state}-${job.reason}`}
                    className="border-b border-line"
                  >
                    <td className="px-5 py-4 font-mono">{job.plugin}</td>
                    <td className="px-5 py-4">{job.version}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-semibold ${
                          job.state === "failed"
                            ? "bg-risk/10 text-risk"
                            : job.state === "running"
                              ? "bg-info/10 text-info"
                              : "bg-surface-subtle text-muted"
                        }`}
                      >
                        {job.state}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-muted">{job.reason}</td>
                    <td className="px-5 py-4 text-right font-mono">{job.runtime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>

    </AppShell>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <span className="text-muted">{label}</span>
      <span className="inline-flex min-w-0 items-center gap-2 text-right font-medium">
        <Database size={14} className="text-muted" aria-hidden="true" />
        <span className="truncate">{value}</span>
      </span>
    </div>
  );
}
