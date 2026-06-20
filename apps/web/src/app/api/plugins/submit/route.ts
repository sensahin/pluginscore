import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

const apiBaseUrl = process.env.PLUGINSCORE_API_URL;

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

  const input = readInput(body);
  if (!input) {
    return NextResponse.json({ error: "input_required" }, { status: 400 });
  }

  const headers = new Headers({
    "content-type": "application/json",
  });
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  if (forwardedFor) {
    headers.set("x-forwarded-for", forwardedFor);
  } else if (realIp) {
    headers.set("x-forwarded-for", realIp);
  }

  let response: Response;
  try {
    response = await fetch(new URL("/plugins/submissions", apiBaseUrl), {
      method: "POST",
      headers,
      body: JSON.stringify({ input }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "api_unavailable" }, { status: 502 });
  }
  const data = await response.json().catch(() => null);

  if (response.ok && data && typeof data === "object" && "slug" in data && typeof data.slug === "string") {
    revalidatePath(`/plugins/${data.slug}`);
    revalidatePath("/search");
    revalidatePath("/");
  }

  return NextResponse.json(data ?? { error: "empty_response" }, {
    status: response.status,
  });
}

function readInput(value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    "input" in value &&
    typeof value.input === "string"
  ) {
    return value.input.trim();
  }

  if (
    value &&
    typeof value === "object" &&
    "slug" in value &&
    typeof value.slug === "string"
  ) {
    return value.slug.trim();
  }

  return "";
}
