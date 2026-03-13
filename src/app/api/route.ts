import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    service: "AI Liquidity Manager API",
    endpoints: ["/api/liquidity", "/api/vault", "/api/ai", "/api/system-status"],
  });
}
