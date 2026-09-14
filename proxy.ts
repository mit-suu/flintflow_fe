import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

interface JwtPayload {
  role?: string;
  exp?: number;
}

function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64Payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");

    let jsonStr: string;
    if (typeof Buffer !== "undefined") {
      jsonStr = Buffer.from(base64Payload, "base64").toString("utf-8");
    } else if (typeof atob === "function") {
      jsonStr = decodeURIComponent(
        atob(base64Payload)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
    } else {
      return null;
    }

    const payload = JSON.parse(jsonStr);

    // If token has exp and is expired, return null
    if (payload?.exp && Date.now() >= payload.exp * 1000) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const accessToken = request.cookies.get("accessToken")?.value;
  const refreshToken = request.cookies.get("refreshToken")?.value;
  const cookieRole = request.cookies.get("userRole")?.value;

  // Validate accessToken
  const decodedAccess = accessToken ? decodeJwt(accessToken) : null;
  const validAccessToken = decodedAccess ? accessToken : null;

  const hasToken = !!(accessToken || refreshToken);
  const resolvedRole = decodedAccess?.role || cookieRole || "user";

  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  const isHomeRoute = pathname === "/home" || pathname.startsWith("/home/");
  const isProjectRoute = pathname === "/projects" || pathname.startsWith("/projects/");
  const isAuthRoute = pathname === "/login" || pathname.startsWith("/login") || pathname === "/register" || pathname.startsWith("/register");

  // 1. Guest attempting protected routes (/home, /admin, /projects) -> redirect to /login
  if ((isHomeRoute || isAdminRoute || isProjectRoute) && !hasToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Non-admin user attempting /admin -> REDIRECT TO /home
  if (isAdminRoute && hasToken && resolvedRole !== "admin") {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  // 3. Logged-in user attempting /login or /register -> redirect to /admin/metrics or /home ONLY IF validAccessToken is valid
  if (isAuthRoute && validAccessToken) {
    if (resolvedRole === "admin") {
      return NextResponse.redirect(new URL("/admin/metrics", request.url));
    }
    return NextResponse.redirect(new URL("/home", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/home/:path*",
    "/admin/:path*",
    "/projects/:path*",
    "/login",
    "/register",
  ],
};
