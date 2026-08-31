import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { setAdminSessionCookie } from "../_session";
import { BackendWakingUpError, backendConfigured, postAdminAuth } from "../_backend";

export async function POST(req: NextRequest) {
  try {
    const { current_password, new_password } = await req.json();

    if (!process.env.JWT_SECRET || !backendConfigured()) {
      return NextResponse.json({ error: "Configuration serveur manquante" }, { status: 500 });
    }

    const token = req.cookies.get("admin_session")?.value;
    if (!token) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    let username: string;
    try {
      const { payload } = await jwtVerify(token, secret);
      if (typeof payload.username !== "string") throw new Error("invalid session");
      username = payload.username;
    } catch {
      return NextResponse.json({ error: "Session invalide" }, { status: 401 });
    }

    if (!current_password || !new_password || String(new_password).length < 8) {
      return NextResponse.json({ error: "Mot de passe invalide (8 caractères minimum)" }, { status: 422 });
    }

    let backendRes: Response;
    try {
      backendRes = await postAdminAuth("change-password", { username, current_password, new_password });
    } catch (e) {
      if (e instanceof BackendWakingUpError) {
        return NextResponse.json(
          { error: "Le serveur redémarre, veuillez réessayer dans quelques instants.", code: "backend_waking_up" },
          { status: 503 }
        );
      }
      throw e;
    }
    if (!backendRes.ok) {
      const detail = (await backendRes.json().catch(() => null))?.detail;
      return NextResponse.json({ error: detail ?? "Mot de passe actuel incorrect" }, { status: 401 });
    }
    const admin = await backendRes.json();

    const res = NextResponse.json({ ok: true });
    await setAdminSessionCookie(res, admin);
    return res;
  } catch (e) {
    console.error("Change password error:", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
