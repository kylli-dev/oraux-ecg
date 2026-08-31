import { NextRequest, NextResponse } from "next/server";
import { setAdminSessionCookie } from "../_session";
import { BackendWakingUpError, backendConfigured, postAdminAuth } from "../_backend";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!process.env.JWT_SECRET || !backendConfigured()) {
      return NextResponse.json({ error: "Configuration serveur manquante" }, { status: 500 });
    }
    if (!username || !password) {
      return NextResponse.json({ error: "Identifiants incorrects" }, { status: 401 });
    }

    let backendRes: Response;
    try {
      backendRes = await postAdminAuth("login", { username, password });
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
