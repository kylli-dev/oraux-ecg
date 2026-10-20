import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

const BASE = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

// Réveil du backend Render (plan Free, en veille après 15 min d'inactivité) dès
// l'arrivée sur une page de connexion : le démarrage (30-60s) a lieu pendant que
// l'utilisateur saisit ses identifiants. Route publique : elle n'appelle que /health
// et ne renvoie qu'un booléen, aucune donnée.
export async function GET() {
  if (!BASE) return NextResponse.json({ awake: false }, { status: 500 });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${BASE}/health`, { cache: "no-store", signal: controller.signal });
    return NextResponse.json({ awake: res.ok }, { status: res.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ awake: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  } finally {
    clearTimeout(timer);
  }
}
