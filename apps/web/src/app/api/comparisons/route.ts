import { NextResponse, type NextRequest } from "next/server";

const apiBaseUrl = process.env.PLUGINSCORE_API_URL;

export async function POST(request: NextRequest) {
  if (!apiBaseUrl) {
    return new NextResponse(null, { status: 204 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const slugs = readSlugs(body);
  if (slugs.length < 2 || slugs.length > 4) {
    return NextResponse.json({ error: "invalid_comparison" }, { status: 400 });
  }

  const headers = new Headers({ "content-type": "application/json" });
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

  try {
    const response = await fetch(new URL("/comparisons", apiBaseUrl), {
      method: "POST",
      headers,
      body: JSON.stringify({ slugs }),
      cache: "no-store",
    });
    const data = await response.json().catch(() => null);

    return NextResponse.json(data ?? { recorded: response.ok }, {
      status: response.status,
    });
  } catch {
    return NextResponse.json({ error: "api_unavailable" }, { status: 502 });
  }
}

function readSlugs(value: unknown) {
  if (!value || typeof value !== "object" || !("slugs" in value)) {
    return [];
  }

  const slugs = (value as { slugs?: unknown }).slugs;
  if (!Array.isArray(slugs)) {
    return [];
  }

  return slugs
    .filter((slug): slug is string => typeof slug === "string")
    .map((slug) => slug.trim())
    .filter(Boolean);
}
