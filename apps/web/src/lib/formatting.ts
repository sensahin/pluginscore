export function formatShortDate(value?: string) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value || "Unknown";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatExactDate(value?: string) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value || "Unknown";
  }

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);

  if (isDateOnly) {
    return formatShortDate(value);
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date);
}

export function formatRelativeDate(value?: string, referenceDate = new Date()) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value || "Unknown";
  }

  const dayDifference = differenceInUtcCalendarDays(date, referenceDate);
  const absoluteDays = Math.abs(dayDifference);
  const suffix = dayDifference < 0 ? "ago" : "";
  const prefix = dayDifference > 0 ? "in " : "";

  if (dayDifference === 0) {
    return "today";
  }

  if (dayDifference === -1) {
    return "yesterday";
  }

  if (dayDifference === 1) {
    return "tomorrow";
  }

  if (absoluteDays < 30) {
    return `${prefix}${absoluteDays} days${suffix ? ` ${suffix}` : ""}`;
  }

  if (absoluteDays < 365) {
    const months = Math.max(1, Math.round(absoluteDays / 30));
    return `${prefix}${months} month${months === 1 ? "" : "s"}${suffix ? ` ${suffix}` : ""}`;
  }

  const years = Math.max(1, Math.round(absoluteDays / 365));
  return `${prefix}${years} year${years === 1 ? "" : "s"}${suffix ? ` ${suffix}` : ""}`;
}

export function toDateTimeAttribute(value?: string) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : date.toISOString();
}

function differenceInUtcCalendarDays(date: Date, referenceDate: Date) {
  const dateDay = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const referenceDay = Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate(),
  );

  return Math.round((dateDay - referenceDay) / 86_400_000);
}

export function formatSlugTitle(slug: string) {
  return decodeURIComponent(slug)
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || "WordPress Plugin";
}
