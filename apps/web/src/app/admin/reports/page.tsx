import type {
  PluginReport,
  PluginReportStatus,
  PluginReportType,
} from "@pluginscore/core";
import { Filter, MessageSquareWarning } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { PaginationControls } from "@/components/pagination-controls";
import { getPluginReportStats, getPluginReports } from "@/lib/api";

type AdminReportsPageProps = {
  searchParams: Promise<{
    page?: string;
    status?: string;
    reportType?: string;
    pluginSlug?: string;
    hasContactEmail?: string;
    createdFrom?: string;
    createdTo?: string;
  }>;
};

export const metadata = {
  title: "Reports",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

const reportTypes: Array<{ value: PluginReportType; label: string }> = [
  { value: "incorrect_metadata", label: "Incorrect metadata" },
  { value: "score_looks_wrong", label: "Score looks wrong" },
  { value: "false_positive_issue", label: "False positive issue" },
  { value: "missing_issue", label: "Missing issue" },
  { value: "plugin_updated", label: "Plugin updated" },
  { value: "other", label: "Other" },
];

const statuses: PluginReportStatus[] = ["new", "triaged", "resolved", "spam"];
const perPage = 25;

export default async function AdminReportsPage({ searchParams }: AdminReportsPageProps) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const status = parseStatus(params.status);
  const reportType = parseReportType(params.reportType);
  const hasContactEmail = parseContactFilter(params.hasContactEmail);
  const [reports, stats] = await Promise.all([
    getPluginReports({
      page,
      perPage,
      status,
      reportType,
      pluginSlug: params.pluginSlug,
      hasContactEmail,
      createdFrom: params.createdFrom,
      createdTo: params.createdTo,
    }),
    getPluginReportStats(),
  ]);

  return (
    <AppShell>
      <section className="rounded-md border border-line bg-surface p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-medium text-brand">Admin</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal">Reports</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
              Profile feedback, score questions, and audit issue reports from plugin pages.
            </p>
          </div>
          <Link
            href="/admin"
            className="inline-flex h-10 items-center justify-center rounded-md border border-line px-3 text-sm font-semibold transition hover:bg-surface-subtle"
          >
            Operations
          </Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <ReportMetric label="Total" value={stats?.total ?? 0} />
        <ReportMetric label="New" value={stats?.new ?? 0} />
        <ReportMetric label="Triaged" value={stats?.triaged ?? 0} />
        <ReportMetric label="Resolved" value={stats?.resolved ?? 0} />
        <ReportMetric label="Spam" value={stats?.spam ?? 0} />
      </section>

      <section className="rounded-md border border-line bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Filters</h2>
          <Filter size={18} className="text-muted" aria-hidden="true" />
        </div>
        <form className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <FilterSelect name="status" label="Status" defaultValue={status ?? ""}>
            <option value="">All</option>
            {statuses.map((item) => (
              <option key={item} value={item}>
                {statusLabel(item)}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect name="reportType" label="Type" defaultValue={reportType ?? ""}>
            <option value="">All</option>
            {reportTypes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </FilterSelect>
          <FilterText name="pluginSlug" label="Plugin slug" defaultValue={params.pluginSlug ?? ""} />
          <FilterSelect
            name="hasContactEmail"
            label="Contact"
            defaultValue={params.hasContactEmail ?? ""}
          >
            <option value="">All</option>
            <option value="true">Has email</option>
            <option value="false">No email</option>
          </FilterSelect>
          <FilterText name="createdFrom" label="From" type="date" defaultValue={params.createdFrom ?? ""} />
          <FilterText name="createdTo" label="To" type="date" defaultValue={params.createdTo ?? ""} />
          <div className="flex items-end gap-2 md:col-span-3 xl:col-span-6">
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-md border border-line px-3 text-sm font-semibold transition hover:bg-surface-subtle"
            >
              Apply
            </button>
            <Link
              href="/admin/reports"
              className="inline-flex h-10 items-center justify-center rounded-md px-3 text-sm font-semibold text-muted transition hover:bg-surface-subtle hover:text-foreground"
            >
              Clear
            </Link>
          </div>
        </form>
      </section>

      <section className="rounded-md border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line p-5">
          <h2 className="text-base font-semibold">Plugin Reports</h2>
          <MessageSquareWarning size={18} className="text-muted" aria-hidden="true" />
        </div>
        {reports.items.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase text-muted">
                    <th className="px-5 py-3 font-semibold">Plugin</th>
                    <th className="px-5 py-3 font-semibold">Report</th>
                    <th className="px-5 py-3 font-semibold">Message</th>
                    <th className="px-5 py-3 font-semibold">Submitted</th>
                    <th className="px-5 py-3 font-semibold">Contact</th>
                    <th className="px-5 py-3 font-semibold">Admin</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.items.map((report) => (
                    <ReportRow key={report.id} report={report} />
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationControls
              basePath="/admin/reports"
              page={reports.page}
              perPage={reports.perPage}
              total={reports.total}
              totalPages={reports.totalPages}
              itemLabel="reports"
              searchParams={{
                status,
                reportType,
                pluginSlug: params.pluginSlug,
                hasContactEmail: params.hasContactEmail,
                createdFrom: params.createdFrom,
                createdTo: params.createdTo,
              }}
            />
          </>
        ) : (
          <p className="p-5 text-sm text-muted">No reports match these filters.</p>
        )}
      </section>
    </AppShell>
  );
}

function ReportRow({ report }: { report: PluginReport }) {
  return (
    <tr className="border-b border-line align-top">
      <td className="px-5 py-4">
        <Link
          href={`/plugins/${encodeURIComponent(report.pluginSlug)}`}
          className="block max-w-[24ch] truncate font-medium hover:text-brand"
        >
          {report.pluginName ?? report.pluginSlug}
        </Link>
        <span className="mt-1 block font-mono text-xs text-muted">{report.pluginSlug}</span>
        <span className="mt-1 block font-mono text-xs text-muted">v{report.pluginVersion}</span>
        {report.auditRunId ? (
          <Link
            href={`/plugins/${encodeURIComponent(report.pluginSlug)}#score-history`}
            className="mt-2 inline-flex text-xs font-semibold text-info hover:underline"
          >
            Audit #{report.auditRunId}
          </Link>
        ) : null}
      </td>
      <td className="px-5 py-4">
        <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${statusClass(report.status)}`}>
          {statusLabel(report.status)}
        </span>
        <span className="mt-2 block text-sm">{reportTypeLabel(report.reportType)}</span>
      </td>
      <td className="max-w-[34ch] px-5 py-4">
        <p className="whitespace-pre-wrap break-words leading-6 text-foreground">{report.message}</p>
        {report.userAgent ? (
          <p className="mt-2 truncate text-xs text-muted">{report.userAgent}</p>
        ) : null}
      </td>
      <td className="px-5 py-4 text-muted">
        <time dateTime={report.createdAt}>{formatDateTime(report.createdAt)}</time>
      </td>
      <td className="max-w-[22ch] truncate px-5 py-4">
        {report.contactEmail ? (
          <a href={`mailto:${report.contactEmail}`} className="text-info hover:underline">
            {report.contactEmail}
          </a>
        ) : (
          <span className="text-muted">No email</span>
        )}
      </td>
      <td className="px-5 py-4">
        <form method="post" action={`/admin/reports/${report.id}`} className="space-y-2">
          <textarea
            name="adminNotes"
            defaultValue={report.adminNotes ?? ""}
            rows={3}
            className="w-full min-w-[260px] resize-y rounded-md border border-line bg-background px-3 py-2 text-sm leading-6 outline-none transition placeholder:text-muted focus:border-brand"
            placeholder="Internal note"
          />
          <div className="flex flex-wrap gap-2">
            {statuses.map((status) => (
              <button
                key={status}
                type="submit"
                name="status"
                value={status}
                className="inline-flex h-8 items-center rounded-md border border-line px-2 text-xs font-semibold transition hover:bg-surface-subtle"
              >
                {statusLabel(status)}
              </button>
            ))}
          </div>
        </form>
      </td>
    </tr>
  );
}

function ReportMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-line bg-surface p-4">
      <p className="text-xs font-medium uppercase text-muted">{label}</p>
      <p className="mt-2 font-mono text-3xl font-semibold">{value.toLocaleString()}</p>
    </div>
  );
}

function FilterText({
  name,
  label,
  defaultValue,
  type = "text",
}: {
  name: string;
  label: string;
  defaultValue: string;
  type?: "text" | "date";
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        className="h-10 w-full rounded-md border border-line bg-background px-3 text-sm outline-none transition focus:border-brand"
      />
    </label>
  );
}

function FilterSelect({
  name,
  label,
  defaultValue,
  children,
}: {
  name: string;
  label: string;
  defaultValue: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="h-10 w-full rounded-md border border-line bg-background px-3 text-sm outline-none transition focus:border-brand"
      >
        {children}
      </select>
    </label>
  );
}

function parsePage(value?: string) {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function parseStatus(value?: string): PluginReportStatus | undefined {
  return statuses.includes(value as PluginReportStatus)
    ? (value as PluginReportStatus)
    : undefined;
}

function parseReportType(value?: string): PluginReportType | undefined {
  return reportTypes.some((type) => type.value === value)
    ? (value as PluginReportType)
    : undefined;
}

function parseContactFilter(value?: string) {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function statusLabel(status: PluginReportStatus) {
  return {
    new: "New",
    triaged: "Triaged",
    resolved: "Resolved",
    spam: "Spam",
  }[status];
}

function statusClass(status: PluginReportStatus) {
  if (status === "new") return "bg-info/10 text-info";
  if (status === "triaged") return "bg-warn/10 text-warn";
  if (status === "resolved") return "bg-good/10 text-good";
  return "bg-risk/10 text-risk";
}

function reportTypeLabel(reportType: PluginReportType) {
  return reportTypes.find((type) => type.value === reportType)?.label ?? "Other";
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "n/a";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}
