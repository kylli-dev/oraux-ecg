import { NextResponse } from "next/server";
import { SignJWT } from "jose";

type AdminSession = {
  id: number | string;
  username: string;
  role: string;
  must_change_password: boolean;
};

export async function setAdminSessionCookie(res: NextResponse, admin: AdminSession) {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  const token = await new SignJWT({
    sub: String(admin.id),
    username: admin.username,
    role: admin.role,
    must_change_password: admin.must_change_password,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secret);

  res.cookies.set("admin_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });
}
