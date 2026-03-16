import { NextResponse } from "next/server";

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL!;
  const adminKey = process.env.ADMIN_API_KEY!;

  if (!adminKey) {
    return NextResponse.json({ detail: "ADMIN_API_KEY missing in frontend env" }, { status: 500 });
  }

  const res = await fetch(`${baseUrl}/admin/plannings`, {
    headers: {
      "X-Admin-Api-Key": adminKey,
    },
    cache: "no-store",
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
  });
}
