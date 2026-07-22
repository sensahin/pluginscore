import { AppShellFrame } from "@/components/app-shell";

const pluginPageGridClass =
  "grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem_20rem]";

export default function PluginLoading() {
  return (
    <AppShellFrame>
      <span className="sr-only">Loading plugin profile</span>
      <section className="mb-2 mt-1">
        <div className={`${pluginPageGridClass} items-start`}>
          <div className="min-w-0">
            <div className="mb-4 flex items-start gap-3">
              <Skeleton className="size-16 shrink-0 rounded-md" />
              <div className="min-w-0 flex-1 space-y-3 pt-1">
                <Skeleton className="h-10 w-4/5 max-w-2xl" />
                <Skeleton className="h-5 w-11/12 max-w-3xl" />
                <Skeleton className="h-5 w-2/3 max-w-2xl" />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-5 w-24 rounded-md" />
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-8 w-24 rounded-md" />
              ))}
            </div>
          </div>

          <section className="rounded-md border border-line bg-gradient-to-br from-surface to-surface-subtle/60 p-5 shadow-sm">
            <div className="flex flex-col items-center">
              <Skeleton className="size-32 rounded-full" />
              <Skeleton className="mt-3 h-4 w-16 rounded-md" />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-20 rounded-md" />
              ))}
            </div>
          </section>

          <section className="rounded-md border border-line bg-gradient-to-br from-surface to-surface-subtle/60 p-5 shadow-sm">
            <Skeleton className="h-5 w-36 rounded-md" />
            <div className="mt-6 space-y-5">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-28 rounded-md" />
                    <Skeleton className="h-4 w-10 rounded-md" />
                  </div>
                  <Skeleton className="mt-2 h-2 w-full rounded-md" />
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>

      <section className={`${pluginPageGridClass} items-start`}>
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <SkeletonPanel rows={4} />
          <SkeletonPanel rows={5} />
          <SkeletonPanel rows={3} />
        </div>

        <aside className="min-w-0 space-y-6 lg:col-start-3">
          <SkeletonPanel rows={7} />
          <SkeletonPanel rows={4} />
          <SkeletonPanel rows={3} />
        </aside>
      </section>
    </AppShellFrame>
  );
}

function SkeletonPanel({ rows }: { rows: number }) {
  return (
    <section className="rounded-md border border-line bg-surface p-5 shadow-sm">
      <Skeleton className="h-5 w-40 rounded-md" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton
            key={index}
            className={`h-12 rounded-md ${index % 3 === 2 ? "w-4/5" : "w-full"}`}
          />
        ))}
      </div>
    </section>
  );
}

function Skeleton({ className }: { className: string }) {
  return (
    <div
      className={`animate-pulse bg-surface-subtle/80 ${className}`}
      aria-hidden="true"
    />
  );
}
