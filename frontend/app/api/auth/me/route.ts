import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("admin_session")?.value;
  if (!token || !process.env.JWT_SECRET) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return NextResponse.json({
      username: payload.username ?? null,
      role: payload.role ?? "admin",
    });
  } catch {
    return NextResponse.json({ error: "Session invalide" }, { status: 401 });
  }
}
