import { NextResponse, type NextRequest } from "next/server";

const apiBaseUrl = process.env.PLUGINSCORE_API_URL;
const reportTypes = new Set([
  "incorrect_metadata",
  "score_looks_wrong",
  "false_positive_issue",
  "missing_issue",
  "plugin_updated",
  "other",
]);

export async function POST(request: NextRequest) {
  if (!apiBaseUrl) {
    return NextResponse.json({ error: "api_not_configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const payload = readReportPayload(body);
  if (!payload.ok) {
    return NextResponse.json({ error: payload.error }, { status: 400 });
  }

  const headers = new Headers({
    "content-type": "application/json",
  });
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const userAgent = request.headers.get("user-agent");

  if (forwardedFor) {
    headers.set("x-forwarded-for", forwardedFor);
  } else if (realIp) {
    headers.set("x-forwarded-for", realIp);
  }

  if (userAgent) {
    headers.set("user-agent", userAgent);
  }

  let response: Response;
  try {
    response = await fetch(
      new URL(`/plugins/${encodeURIComponent(payload.value.pluginSlug)}/reports`, apiBaseUrl),
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload.value),
        cache: "no-store",
      },
    );
  } catch {
    return NextResponse.json({ error: "api_unavailable" }, { status: 502 });
  }

  const data = await response.json().catch(() => null);
  return NextResponse.json(data ?? { error: "empty_response" }, {
    status: response.status,
  });
}

function readReportPayload(value: unknown):
  | {
      ok: true;
      value: {
        pluginSlug: string;
        pluginVersion?: string;
        auditRunId?: number;
        reportType: string;
        message: string;
        contactEmail?: string;
        website?: string;
      };
    }
  | { ok: false; error: string } {
  if (!value || typeof value !== "object") {
    return { ok: false, error: "invalid_payload" };
  }

  const record = value as Record<string, unknown>;
  const pluginSlug = readString(record.pluginSlug);
  const reportType = readString(record.reportType);
  const message = readString(record.message);
  const contactEmail = readString(record.contactEmail);
  const pluginVersion = readString(record.pluginVersion);
  const website = readString(record.website);
  const auditRunId = readPositiveInteger(record.auditRunId);

  if (!pluginSlug) {
    return { ok: false, error: "plugin_required" };
  }

  if (!reportType || !reportTypes.has(reportType)) {
    return { ok: false, error: "report_type_required" };
  }

  if (message.length < 10) {
    return { ok: false, error: "message_too_short" };
  }

  if (message.length > 2000) {
    return { ok: false, error: "message_too_long" };
  }

  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return { ok: false, error: "invalid_email" };
  }

  return {
    ok: true,
    value: {
      pluginSlug,
      pluginVersion,
      auditRunId,
      reportType,
      message,
      contactEmail,
      website,
    },
  };
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readPositiveInteger(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}
