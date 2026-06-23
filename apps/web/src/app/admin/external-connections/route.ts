import type { ExternalConnectionAnalysisMode } from "@pluginscore/core";
import { NextResponse } from "next/server";
import { updateExternalConnectionSettings } from "@/lib/api";

export async function POST(request: Request) {
  const formData = await request.formData();
  const mode = parseMode(formData.get("mode"));
  const sampleRemaining = parseSampleRemaining(formData.get("sampleRemaining"));

  await updateExternalConnectionSettings({
    mode,
    sampleRemaining,
  });

  return NextResponse.redirect(new URL("/admin", request.url), { status: 303 });
}

function parseMode(value: FormDataEntryValue | null): ExternalConnectionAnalysisMode {
  return value === "new_scans" || value === "sample" ? value : "off";
}

function parseSampleRemaining(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, 1000)) : undefined;
}
