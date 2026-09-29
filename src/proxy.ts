import { NextResponse, type NextRequest } from "next/server";

// Optimistic gate only: real authentication is verified against the database
// in the data access layer (lib/session.ts, lib/store-access.ts).
const PROTECTED = ["/setup", "/menu", "/settings", "/customers", "/inventory"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasCookie = request.cookies.has("vm_session");
  if (!hasCookie && PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
