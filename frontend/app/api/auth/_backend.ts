const BASE = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const KEY = process.env.ADMIN_API_KEY ?? "";

// Le backend Render (plan Free) se met en veille après 15 min d'inactivité et met
// 30-60s à redémarrer. On abandonne avant la limite Vercel (maxDuration) pour
// distinguer ce cas et laisser le frontend afficher un message clair + réessayer.
const BACKEND_TIMEOUT_MS = 8000;

export class BackendWakingUpError extends Error {}

export function backendConfigured(): boolean {
  return !!BASE && !!KEY;
}

export async function postAdminAuth(path: string, body: unknown): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
  try {
    return await fetch(`${BASE}/admin/auth/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Api-Key": KEY },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw new BackendWakingUpError();
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
