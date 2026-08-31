import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

const BASE = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const KEY  = process.env.ADMIN_API_KEY ?? "";

// Le backend Render (plan Free) se met en veille après 15 min d'inactivité et met
// 30-60s à redémarrer. On abandonne notre propre fetch avant la limite Vercel
// (maxDuration=10s) pour renvoyer une réponse contrôlée plutôt qu'un
// FUNCTION_INVOCATION_TIMEOUT brut — le frontend peut alors afficher un message
// clair et réessayer automatiquement (voir `apiCall` dans admin/page.tsx).
const BACKEND_TIMEOUT_MS = 8000;

async function fetchBackend(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function wakingUpResponse() {
  return NextResponse.json(
    { detail: "Le serveur redémarre, veuillez réessayer dans quelques instants.", code: "backend_waking_up" },
    { status: 503 }
  );
}

async function currentAdminRole(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get("admin_session")?.value;
  if (!token || !process.env.JWT_SECRET) return null;
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const joined   = path.join("/");
  const search   = req.nextUrl.searchParams.toString();
  const url      = `${BASE}/admin/${joined}/${search ? "?" + search : ""}`;

  if (!KEY)  return NextResponse.json({ detail: "ADMIN_API_KEY manquant" },  { status: 500 });
  if (!BASE) return NextResponse.json({ detail: "API_BASE_URL manquant" }, { status: 500 });

  try {
    const role = await currentAdminRole(req);
    const headers: Record<string, string> = { "X-Admin-Api-Key": KEY };
    if (role) headers["X-Admin-Role"] = role;
    const r = await fetchBackend(url, { headers, cache: "no-store" });
    const ct = r.headers.get("content-type") ?? "application/json";
    const isBinary = ct.includes("application/pdf") || ct.includes("application/zip") ||
      ct.includes("application/vnd.openxmlformats") || ct.includes("application/octet-stream");
    const body = isBinary ? await r.arrayBuffer() : await r.text();
    const resHeaders: Record<string, string> = { "Content-Type": ct, "Cache-Control": "no-store" };
    const cd = r.headers.get("content-disposition");
    if (cd) resHeaders["Content-Disposition"] = cd;
    return new NextResponse(body, { status: r.status, headers: resHeaders });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") return wakingUpResponse();
    return NextResponse.json({ detail: String(e) }, { status: 502 });
  }
}

async function mut(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const joined   = path.join("/");
  const search   = req.nextUrl.searchParams.toString();
  // Pas de trailing slash pour les mutations : le body multipart serait perdu sur le 307 redirect
  const url      = `${BASE}/admin/${joined}${search ? "?" + search : ""}`;

  if (!KEY)  return NextResponse.json({ detail: "ADMIN_API_KEY manquant" },  { status: 500 });
  if (!BASE) return NextResponse.json({ detail: "API_BASE_URL manquant" }, { status: 500 });

  try {
    const ct   = req.headers.get("content-type") ?? "";
    const body = ct.includes("multipart") ? await req.arrayBuffer() : await req.text();
    const role = await currentAdminRole(req);
    const hdrs: Record<string, string> = { "X-Admin-Api-Key": KEY };
    if (role) hdrs["X-Admin-Role"] = role;
    if (body) hdrs["Content-Type"] = ct.includes("multipart") ? ct : "application/json";

    const r = await fetchBackend(url, {
      method: req.method,
      headers: hdrs,
      body: body instanceof ArrayBuffer ? body : (body || undefined),
      cache: "no-store",
    });

    if (r.status === 204) return new NextResponse(null, { status: 204 });
    const resCt = r.headers.get("content-type") ?? "application/json";
    const isBinary = resCt.includes("application/pdf") || resCt.includes("application/zip") ||
      resCt.includes("application/vnd.openxmlformats") || resCt.includes("application/octet-stream");
    const resBody = isBinary ? await r.arrayBuffer() : await r.text();
    const resHeaders: Record<string, string> = { "Content-Type": resCt, "Cache-Control": "no-store" };
    const cd = r.headers.get("content-disposition");
    if (cd) resHeaders["Content-Disposition"] = cd;
    return new NextResponse(resBody, { status: r.status, headers: resHeaders });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") return wakingUpResponse();
    return NextResponse.json({ detail: String(e) }, { status: 502 });
  }
}

export const POST   = mut;
export const PUT    = mut;
export const PATCH  = mut;
export const DELETE = mut;
