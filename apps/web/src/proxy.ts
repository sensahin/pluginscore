import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  const password = process.env.PLUGINSCORE_ADMIN_PASSWORD;
  if (!password) {
    return new NextResponse("Not found", { status: 404 });
  }

  const username = process.env.PLUGINSCORE_ADMIN_USERNAME ?? "admin";
  const authorization = request.headers.get("authorization");
  const expected = `Basic ${btoa(`${username}:${password}`)}`;

  if (authorization !== expected) {
    return new NextResponse("Authentication required", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="PluginScore Admin"',
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
