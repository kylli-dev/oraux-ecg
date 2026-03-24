import { NextRequest, NextResponse } from "next/server";

// Désactive le body parser intégré de Next.js pour ce segment
// (on lit le body manuellement selon le content-type)
export const dynamic = "force-dynamic";

async function proxy(req: NextRequest, pathSegments: string[]) {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL!;
  const adminKey = process.env.ADMIN_API_KEY!;

  if (!adminKey) {
    return NextResponse.json({ detail: "ADMIN_API_KEY missing" }, { status: 500 });
  }

  const path = pathSegments.join("/");
  const search = req.nextUrl.searchParams.toString();
  const upstream = `${baseUrl}/admin/${path}${search ? "?" + search : ""}`;

  const headers: Record<string, string> = { "X-Admin-Api-Key": adminKey };

  const contentType = req.headers.get("content-type") ?? "";
  const isMultipart = contentType.includes("multipart/form-data");

  try {
    let res: Response;

    if (!["GET", "HEAD"].includes(req.method)) {
      if (isMultipart) {
        const buf = await req.arrayBuffer();
        res = await fetch(upstream, {
          method: req.method,
          headers: { ...headers, "Content-Type": contentType },
          body: buf,
          // @ts-expect-error — Node.js fetch nécessite duplex pour les streams
          duplex: "half",
          cache: "no-store",
        });
      } else {
        const text = await req.text();
        res = await fetch(upstream, {
          method: req.method,
          headers: text ? { ...headers, "Content-Type": "application/json" } : headers,
          body: text || undefined,
          cache: "no-store",
        });
      }
    } else {
      res = await fetch(upstream, {
        method: req.method,
        headers,
        cache: "no-store",
      });
    }

    if (res.status === 204) return new NextResponse(null, { status: 204 });

    const upstreamContentType = res.headers.get("content-type") ?? "application/json";
    const contentDisposition = res.headers.get("content-disposition");
    const resBuf = await res.arrayBuffer();
    const responseHeaders: Record<string, string> = { "Content-Type": upstreamContentType };
    if (contentDisposition) responseHeaders["Content-Disposition"] = contentDisposition;
    return new NextResponse(resBuf, { status: res.status, headers: responseHeaders });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[proxy] erreur:", msg);
    return NextResponse.json({ detail: `Backend inaccessible : ${msg}` }, { status: 502 });
  }
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  return proxy(req, (await params).path);
}
export async function POST(req: NextRequest, { params }: Ctx) {
  return proxy(req, (await params).path);
}
export async function PUT(req: NextRequest, { params }: Ctx) {
  return proxy(req, (await params).path);
}
export async function PATCH(req: NextRequest, { params }: Ctx) {
  return proxy(req, (await params).path);
}
export async function DELETE(req: NextRequest, { params }: Ctx) {
  return proxy(req, (await params).path);
}
