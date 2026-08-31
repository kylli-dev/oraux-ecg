import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC = ["/admin/login", "/api/auth/login"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Ne protège que /admin/*
  if (!pathname.startsWith("/admin")) return NextResponse.next();

  // Routes publiques
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const token = req.cookies.get("admin_session")?.value;
  if (!token) return redirectToLogin(req);

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const { payload } = await jwtVerify(token, secret);

    if (payload.must_change_password === true && pathname !== "/admin/change-password") {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/change-password";
      url.searchParams.set("forced", "1");
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  } catch {
    return redirectToLogin(req);
  }
}

function redirectToLogin(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  url.searchParams.set("from", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*"],
};
