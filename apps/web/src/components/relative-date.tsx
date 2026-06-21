import { formatExactDate, formatRelativeDate, toDateTimeAttribute } from "@/lib/formatting";

export function RelativeDate({
  value,
  fallback = "Unknown",
}: {
  value?: string;
  fallback?: string;
}) {
  if (!value) {
    return <>{fallback}</>;
  }

  const dateTime = toDateTimeAttribute(value);
  const exactDate = formatExactDate(value);

  return (
    <time dateTime={dateTime} title={exactDate} suppressHydrationWarning>
      {formatRelativeDate(value)}
    </time>
  );
}
