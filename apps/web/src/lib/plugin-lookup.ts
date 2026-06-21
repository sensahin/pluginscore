export type WordPressPluginLookupResult = {
  slug: string;
  name: string;
  version: string;
  activeInstalls?: number;
  rating?: number;
  ratingCount?: number;
};

export class PluginLookupError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

type LookupResponse =
  | Partial<WordPressPluginLookupResult>
  | { error?: string; slug?: string };

export async function lookupWordPressPlugin(input: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ input });
  const response = await fetch(`/api/plugins/lookup?${params.toString()}`, {
    signal,
  });
  const data = (await response.json().catch(() => null)) as LookupResponse | null;

  if (!response.ok) {
    throw new PluginLookupError(
      lookupErrorMessage(response.status, data && "error" in data ? data.error : undefined),
      response.status,
      data && "error" in data ? data.error : undefined,
    );
  }

  if (!data || !("slug" in data) || !data.slug || !("name" in data) || !data.name) {
    throw new PluginLookupError("Unable to check WordPress.org.", response.status);
  }

  return data as WordPressPluginLookupResult;
}

function lookupErrorMessage(status: number, code?: string) {
  if (status === 404 || code === "wordpress_plugin_not_found") {
    return "No WordPress.org plugin found.";
  }

  if (status === 400 || code === "invalid_plugin_slug") {
    return "Enter a WordPress.org plugin slug or URL.";
  }

  return "Unable to check WordPress.org.";
}
