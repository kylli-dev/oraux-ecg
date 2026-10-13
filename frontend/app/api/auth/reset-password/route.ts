import { NextRequest, NextResponse } from "next/server";
import { BackendWakingUpError, backendConfigured, postAdminAuth } from "../_backend";

// Réinitialisation du mot de passe d'un compte admin avec le lien reçu par email.
export async function POST(req: NextRequest) {
  if (!backendConfigured()) {
    return NextResponse.json({ error: "Configuration serveur manquante" }, { status: 500 });
  }
  const { token, new_password } = await req.json().catch(() => ({}));
  if (typeof token !== "string" || !token || typeof new_password !== "string") {
    return NextResponse.json({ error: "Lien invalide ou expiré" }, { status: 400 });
  }
  if (new_password.length < 8) {
    return NextResponse.json({ error: "Le mot de passe doit contenir au moins 8 caractères" }, { status: 422 });
  }
  try {
    const r = await postAdminAuth("reset-password", { token, new_password });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      return NextResponse.json({ error: d.detail ?? "Lien invalide ou expiré" }, { status: r.status === 422 ? 422 : 400 });
    }
  } catch (e) {
    if (e instanceof BackendWakingUpError) {
      return NextResponse.json(
        { error: "Le serveur redémarre, veuillez réessayer dans quelques instants.", code: "backend_waking_up" },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
