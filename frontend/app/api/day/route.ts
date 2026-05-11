import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl}/admin/plannings/${planningId}/day?date=${date}`, {
      headers: { "X-Admin-Api-Key": adminKey },
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ detail: `Backend inaccessible : ${msg}` }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  });
}
