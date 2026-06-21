import type { PluginReportStatus } from "@pluginscore/core";
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { updatePluginReport } from "@/lib/api";

const statuses = new Set(["new", "triaged", "resolved", "spam"]);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await context.params;
  const id = Number.parseInt(rawId, 10);
  const redirectUrl = request.headers.get("referer") ?? new URL("/admin/reports", request.url).toString();

  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.redirect(withError(redirectUrl, "invalid_report"), { status: 303 });
  }

  const formData = await request.formData();
  const status = readStatus(formData.get("status"));
  const adminNotes = readString(formData.get("adminNotes"));

  try {
    await updatePluginReport(id, { status, adminNotes });
    revalidatePath("/admin/reports");
    revalidatePath("/admin");
    return NextResponse.redirect(redirectUrl, { status: 303 });
  } catch {
    return NextResponse.redirect(withError(redirectUrl, "update_failed"), { status: 303 });
  }
}

function readStatus(value: FormDataEntryValue | null): PluginReportStatus | undefined {
  const status = typeof value === "string" ? value : "";
  return statuses.has(status) ? (status as PluginReportStatus) : undefined;
}

function readString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : undefined;
}

function withError(value: string, error: string) {
  const url = new URL(value);
  url.searchParams.set("error", error);
  return url;
}
