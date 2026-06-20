export function formatPluginDirectoryAge(addedAt?: string) {
  const addedDate = parsePluginDate(addedAt);

  if (!addedDate) {
    return undefined;
  }

  const now = new Date();
  let months =
    (now.getUTCFullYear() - addedDate.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - addedDate.getUTCMonth());

  if (now.getUTCDate() < addedDate.getUTCDate()) {
    months -= 1;
  }

  if (months < 0) {
    return undefined;
  }

  if (months < 1) {
    return "Less than 1 month";
  }

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  const parts: string[] = [];

  if (years > 0) {
    parts.push(`${years} ${years === 1 ? "year" : "years"}`);
  }

  if (remainingMonths > 0 && years < 5) {
    parts.push(
      `${remainingMonths} ${remainingMonths === 1 ? "month" : "months"}`,
    );
  }

  return parts.join(" ");
}

function parsePluginDate(value?: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
