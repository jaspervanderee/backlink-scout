import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function isDevRouteEnabled() {
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  return process.env.DEV_ROUTE_ENABLED === "true";
}

export function middleware(request: NextRequest) {
  if (!isDevRouteEnabled()) {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/dev/:path*",
};
