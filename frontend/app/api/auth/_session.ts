import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";

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

// Vrai si la requête porte un cookie de session admin valide (signé, non expiré).
// À appeler dans toute route /api/* qui relaie vers l'API admin avec ADMIN_API_KEY.
export async function estAdminConnecte(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get("admin_session")?.value;
  if (!token || !process.env.JWT_SECRET) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
    return true;
  } catch {
    return false;
  }
}
