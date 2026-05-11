import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  // Retourne immédiatement pour tester si le handler charge correctement
  const { path } = await params;
  const joined = path.join("/");

  // Test minimal : ne pas contacter Render, juste répondre
  return NextResponse.json({
    ok: true,
    path: joined,
    env_key: !!process.env.ADMIN_API_KEY,
    env_pub: !!process.env.NEXT_PUBLIC_API_BASE_URL,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return NextResponse.json({ ok: true, method: "POST" });
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return NextResponse.json({ ok: true, method: "PUT" });
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return NextResponse.json({ ok: true, method: "PATCH" });
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return NextResponse.json({ ok: true, method: "DELETE" });
}
