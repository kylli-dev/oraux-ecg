import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

async function proxy(req: NextRequest, path: string[]) {
  const baseUrl = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
  const adminKey = process.env.ADMIN_API_KEY ?? "";

  if (!adminKey) {
    return NextResponse.json({ detail: "ADMIN_API_KEY non configuré" }, { status: 500 });
  }
  if (!baseUrl) {
    return NextResponse.json({ detail: "API_BASE_URL non configuré" }, { status: 500 });
  }

  const joined = path.join("/");
  const search = req.nextUrl.searchParams.toString();
  // Trailing slash systématique pour éviter le 307 de FastAPI
  const upstream = `${baseUrl}/admin/${joined}/${search ? "?" + search : ""}`;

  const headers: Record<string, string> = { "X-Admin-Api-Key": adminKey };
  const contentType = req.headers.get("content-type") ?? "";

  try {
    let body: BodyInit | undefined;
    if (!["GET", "HEAD"].includes(req.method)) {
      body = contentType.includes("multipart/form-data")
        ? Buffer.from(await req.arrayBuffer())
        : (await req.text()) || undefined;
      if (body) headers["Content-Type"] = contentType.includes("multipart")
        ? contentType
        : "application/json";
    }

    const res = await fetch(upstream, {
      method: req.method,
      headers,
      body,
      redirect: "follow",
      cache: "no-store",
    });

    if (res.status === 204) return new NextResponse(null, { status: 204 });

    const ct = res.headers.get("content-type") ?? "application/json";
    const cd = res.headers.get("content-disposition");
    const buf = await res.arrayBuffer();
    const out: Record<string, string> = { "Content-Type": ct };
    if (cd) out["Content-Disposition"] = cd;
    return new NextResponse(buf, { status: res.status, headers: out });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ detail: `Erreur proxy : ${msg}` }, { status: 502 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await params).path);
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await params).path);
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await params).path);
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await params).path);
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await params).path);
}
