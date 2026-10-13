import { NextRequest, NextResponse } from "next/server";
import { BackendWakingUpError, backendConfigured, postAdminAuth } from "../_backend";

// « Mot de passe oublié » d'un compte admin : relais vers le backend (qui exige la clé
// ADMIN_API_KEY, ajoutée ici côté serveur). Route publique — la réponse est toujours la
// même, que le compte existe ou non, pour ne pas révéler quels comptes existent.
export async function POST(req: NextRequest) {
  if (!backendConfigured()) {
    return NextResponse.json({ error: "Configuration serveur manquante" }, { status: 500 });
  }
  const { identifiant } = await req.json().catch(() => ({ identifiant: "" }));
  if (typeof identifiant !== "string" || !identifiant.trim()) {
    return NextResponse.json({ error: "Saisissez votre nom d'utilisateur ou votre adresse email" }, { status: 422 });
  }
  try {
    await postAdminAuth("forgot-password", { identifiant: identifiant.trim().slice(0, 255) });
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
