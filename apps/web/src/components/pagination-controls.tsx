import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type PaginationControlsProps = {
  basePath: string;
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  searchParams?: Record<string, string | number | boolean | undefined>;
  itemLabel?: string;
};

export function PaginationControls({
  basePath,
  page,
  perPage,
  total,
  totalPages,
  searchParams = {},
  itemLabel = "plugins",
}: PaginationControlsProps) {
  if (totalPages <= 1) {
    return null;
  }

  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * perPage + 1;
  const end = Math.min(total, safePage * perPage);

  return (
    <nav
      className="flex flex-col gap-3 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
      aria-label="Pagination"
    >
      <p className="text-sm text-muted">
        {start.toLocaleString()}-{end.toLocaleString()} of {total.toLocaleString()} {itemLabel}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <PageLink
          href={pageHref(basePath, safePage - 1, searchParams)}
          disabled={safePage <= 1}
          label="Previous page"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </PageLink>
        {paginationItems(safePage, totalPages).map((item, index) =>
          item === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              className="flex h-9 min-w-9 items-center justify-center rounded-md border border-transparent px-2 text-sm text-muted"
            >
              ...
            </span>
          ) : (
            <PageLink
              key={item}
              href={pageHref(basePath, item, searchParams)}
              current={item === safePage}
              label={`Page ${item}`}
            >
              {item}
            </PageLink>
          ),
        )}
        <PageLink
          href={pageHref(basePath, safePage + 1, searchParams)}
          disabled={safePage >= totalPages}
          label="Next page"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </PageLink>
      </div>
    </nav>
  );
}

function PageLink({
  href,
  children,
  current,
  disabled,
  label,
}: {
  href: string;
  children: ReactNode;
  current?: boolean;
  disabled?: boolean;
  label: string;
}) {
  const className = `flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-sm font-medium transition ${
    current
      ? "border-brand/40 bg-brand/10 text-foreground"
      : "border-line text-muted hover:bg-surface-subtle hover:text-foreground"
  } ${disabled ? "pointer-events-none opacity-45" : ""}`;

  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={current ? "page" : undefined}
      aria-disabled={disabled ? true : undefined}
      className={className}
    >
      {children}
    </Link>
  );
}

function pageHref(
  basePath: string,
  page: number,
  searchParams: Record<string, string | number | boolean | undefined>,
) {
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (value === undefined || value === "" || value === false) {
      return;
    }

    params.set(key, String(value));
  });

  if (page > 1) {
    params.set("page", String(page));
  } else {
    params.delete("page");
  }

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

function paginationItems(page: number, totalPages: number) {
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const ordered = [...pages]
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((a, b) => a - b);
  const items: Array<number | "ellipsis"> = [];

  for (const value of ordered) {
    const previous = items[items.length - 1];

    if (typeof previous === "number" && value - previous > 1) {
      items.push("ellipsis");
    }

    items.push(value);
  }

  return items;
}
