import { BarChart3 } from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { getStats } from "@/lib/api";

const navItems = [
  { href: "/rankings", label: "Rankings", icon: BarChart3 },
];

const githubUrl =
  process.env.NEXT_PUBLIC_GITHUB_URL ?? "https://github.com/sensahin/pluginscore";

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

export async function AppShell({ children }: { children: React.ReactNode }) {
  const stats = await getStats();
  const indexedLabel = stats.indexedPlugins.toLocaleString();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark className="size-9 shrink-0" />
            <span className="text-base font-semibold">PluginScore</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted transition hover:bg-surface-subtle hover:text-foreground"
                >
                  <Icon size={16} aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
            <a
              href={githubUrl}
              className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted transition hover:bg-surface-subtle hover:text-foreground"
              target="_blank"
              rel="noreferrer"
            >
              <GitHubMark className="size-4" />
              GitHub
            </a>
          </nav>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 text-xs text-muted sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <p>
            <span className="font-mono text-foreground">{indexedLabel}</span>{" "}
            plugins indexed
          </p>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href="/about" className="hover:text-foreground">
              About
            </Link>
            <Link href="/tags" className="hover:text-foreground">
              Tags
            </Link>
            <Link href="/issues" className="hover:text-foreground">
              Issues
            </Link>
            <Link href="/methodology" className="hover:text-foreground">
              Methodology
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
