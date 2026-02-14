import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ error: "discord_linking_not_implemented" }, { status: 501 });
}

export async function POST() {
  return NextResponse.json({ error: "discord_linking_not_implemented" }, { status: 501 });
}

