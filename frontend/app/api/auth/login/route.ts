import { NextRequest, NextResponse } from "next/server";
import { setAdminSessionCookie } from "../_session";

const BASE = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const KEY = process.env.ADMIN_API_KEY ?? "";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!process.env.JWT_SECRET || !KEY || !BASE) {
      return NextResponse.json({ error: "Configuration serveur manquante" }, { status: 500 });
    }
    if (!username || !password) {
      return NextResponse.json({ error: "Identifiants incorrects" }, { status: 401 });
    }

    const backendRes = await fetch(`${BASE}/admin/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Api-Key": KEY },
      body: JSON.stringify({ username, password }),
      cache: "no-store",
    });
    if (!backendRes.ok) {
      return NextResponse.json({ error: "Identifiants incorrects" }, { status: 401 });
    }
    const admin = await backendRes.json();

    const res = NextResponse.json({ ok: true, must_change_password: !!admin.must_change_password });
    await setAdminSessionCookie(res, admin);
    return res;
  } catch (e) {
    console.error("Login error:", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
