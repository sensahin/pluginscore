export const PLUGIN_DIRECTORY_PER_PAGE = 50;

export function normalizePageParam(value?: string) {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function pageFromSegment(value?: string) {
  if (!value || !/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function titleWithPage(title: string, page: number) {
  return page > 1 ? `${title} - Page ${page}` : title;
}
