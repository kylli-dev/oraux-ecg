import { NextRequest, NextResponse } from "next/server";

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

  let fetchBody: BodyInit | undefined;
  if (!["GET", "HEAD"].includes(req.method)) {
    if (isMultipart) {
      // Forward as FormData — let fetch set Content-Type with boundary
      fetchBody = await req.formData();
    } else {
      const text = await req.text();
      if (text) {
        fetchBody = text;
        headers["Content-Type"] = "application/json";
      }
    }
  }

  const res = await fetch(upstream, {
    method: req.method,
    headers,
    body: fetchBody,
    cache: "no-store",
  });

  if (res.status === 204) return new NextResponse(null, { status: 204 });

  // Stream binary responses (e.g. Excel export) transparently
  const upstreamContentType = res.headers.get("content-type") ?? "application/json";
  const buf = await res.arrayBuffer();
  return new NextResponse(buf, {
    status: res.status,
    headers: { "Content-Type": upstreamContentType },
  });
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
