import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL!;
  const adminKey = process.env.ADMIN_API_KEY!;

  if (!adminKey) {
    return NextResponse.json({ detail: "ADMIN_API_KEY missing in frontend env" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const planningId = searchParams.get("planning_id");
  const date = searchParams.get("date");

  if (!planningId || !date) {
    return NextResponse.json({ detail: "planning_id and date are required" }, { status: 422 });
  }

  const upstream = await fetch(`${baseUrl}/admin/plannings/${planningId}/day?date=${date}`, {
    headers: { "X-Admin-Api-Key": adminKey },
    cache: "no-store",
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  });
}
