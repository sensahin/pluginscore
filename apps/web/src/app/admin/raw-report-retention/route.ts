import { NextResponse } from "next/server";
import { runRawReportRetention } from "@/lib/api";

export async function POST(request: Request) {
  const redirectUrl = new URL("/admin", request.url);
  redirectUrl.searchParams.set("view", "system");

  try {
    const result = await runRawReportRetention();
    redirectUrl.searchParams.set("rawPruned", String(result.prunedReports));
    redirectUrl.searchParams.set("rawBytes", String(result.prunedBytes));
  } catch (error) {
    console.error("Raw-report cleanup failed:", error);
    redirectUrl.searchParams.set("rawCleanup", "failed");
  }

  return NextResponse.redirect(redirectUrl, { status: 303 });
}
