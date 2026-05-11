import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

const BASE = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const KEY  = process.env.ADMIN_API_KEY ?? "";

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const joined   = path.join("/");
  const search   = req.nextUrl.searchParams.toString();
  const url      = `${BASE}/admin/${joined}/${search ? "?" + search : ""}`;

  if (!KEY)  return NextResponse.json({ detail: "ADMIN_API_KEY manquant" },  { status: 500 });
  if (!BASE) return NextResponse.json({ detail: "API_BASE_URL manquant" }, { status: 500 });

  try {
    const r = await fetch(url, {
      headers: { "X-Admin-Api-Key": KEY },
      cache: "no-store",
    });
    const text = await r.text();
    const resHeaders: Record<string, string> = {
      "Content-Type": r.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
    };
    const cd = r.headers.get("content-disposition");
    if (cd) resHeaders["Content-Disposition"] = cd;
    return new NextResponse(text, { status: r.status, headers: resHeaders });
  } catch (e) {
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
    const hdrs: Record<string, string> = { "X-Admin-Api-Key": KEY };
    if (body) hdrs["Content-Type"] = ct.includes("multipart") ? ct : "application/json";

    const r = await fetch(url, {
      method: req.method,
      headers: hdrs,
      body: body instanceof ArrayBuffer ? body : (body || undefined),
      cache: "no-store",
    });

    if (r.status === 204) return new NextResponse(null, { status: 204 });
    const text = await r.text();
    const resHeaders: Record<string, string> = {
      "Content-Type": r.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
    };
    const cd = r.headers.get("content-disposition");
    if (cd) resHeaders["Content-Disposition"] = cd;
    return new NextResponse(text, { status: r.status, headers: resHeaders });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 502 });
  }
}

export const POST   = mut;
export const PUT    = mut;
export const PATCH  = mut;
export const DELETE = mut;
