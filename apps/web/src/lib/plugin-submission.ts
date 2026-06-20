import type { PluginSubmissionResult } from "@pluginscore/core";

export class PluginSubmissionError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

export function normalizePluginSubmissionInput(value: string) {
  const trimmed = value.trim().toLowerCase();
  let slug = trimmed;

  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    if (url.hostname === "wordpress.org" && url.pathname.startsWith("/plugins/")) {
      slug = url.pathname.replace(/^\/plugins\//, "").split("/")[0] ?? "";
    }
  } catch {
    slug = trimmed
      .replace(/^https?:\/\/wordpress\.org\/plugins\//, "")
      .replace(/^wordpress\.org\/plugins\//, "");
  }

  return slug
    .replace(/\/$/, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function submitPluginForScan(input: string) {
  const response = await fetch("/api/plugins/submit", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ input }),
  });

  const data = await response.json().catch(() => null) as
    | (Partial<PluginSubmissionResult> & { error?: string })
    | null;

  if (!response.ok) {
    throw new PluginSubmissionError(
      submissionErrorMessage(response.status, data?.error),
      response.status,
      data?.error,
    );
  }

  if (!data?.slug || !data.pluginUrl) {
    throw new PluginSubmissionError("Unable to start scan.", response.status);
  }

  return data as PluginSubmissionResult;
}

function submissionErrorMessage(status: number, code?: string) {
  if (status === 404 || code === "wordpress_plugin_not_found") {
    return "Not found on WordPress.org.";
  }

  if (status === 429 || code === "rate_limited") {
    return "Please try again in a minute.";
  }

  if (status === 400) {
    return "Enter a WordPress.org plugin slug or URL.";
  }

  return "Unable to start scan.";
}
