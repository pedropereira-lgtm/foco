import { NextResponse } from "next/server";
import { platformMonth } from "@/lib/server/stripe";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.has("force");
  return NextResponse.json(await platformMonth(force));
}
