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

  const slug = readSlug(body);
  if (!slug) {
    return NextResponse.json({ error: "slug_required" }, { status: 400 });
  }

  try {
    const response = await fetch(new URL("/searches", apiBaseUrl), {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ slug }),
      cache: "no-store",
    });

    if (!response.ok && response.status !== 404) {
      console.warn(`PluginScore search record failed: ${response.status}`);
    }
  } catch (error) {
    console.warn("PluginScore search record failed:", error);
  }

  return new NextResponse(null, { status: 204 });
}

function readSlug(value: unknown) {
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
