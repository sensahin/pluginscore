import { BarChart3, GitCompareArrows, Tag } from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { getStats } from "@/lib/api";

const navItems = [
  { href: "/rankings", label: "Rankings", icon: BarChart3 },
  { href: "/tags", label: "Categories", icon: Tag },
  { href: "/compare", label: "Compare", icon: GitCompareArrows },
];

const githubUrl =
  process.env.NEXT_PUBLIC_GITHUB_URL ?? "https://github.com/sensahin/pluginscore";

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
              Categories
            </Link>
            <Link href="/issues" className="hover:text-foreground">
              Issues
            </Link>
            <Link href="/domains" className="hover:text-foreground">
              External Domains
            </Link>
            <Link href="/methodology" className="hover:text-foreground">
              Methodology
            </Link>
            <a
              href={githubUrl}
              className="hover:text-foreground"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
