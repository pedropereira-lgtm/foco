import { NextResponse } from "next/server";
import { applyOps, loadState, usingSupabase, type Ops } from "@/lib/server/db";
import { COLLECTIONS, type Collection } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = await loadState();
    return NextResponse.json({ state, storage: usingSupabase() ? "supabase" : "local" });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

const ALLOWED = new Set<string>([...COLLECTIONS, "settings"]);

export async function POST(req: Request) {
  const ops = (await req.json().catch(() => null)) as Ops | null;
  if (!ops) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  for (const k of [...Object.keys(ops.put ?? {}), ...Object.keys(ops.del ?? {})]) {
    if (!ALLOWED.has(k)) return NextResponse.json({ error: `Coleção desconhecida: ${k}` }, { status: 400 });
  }
  try {
    await applyOps(ops as { put?: Partial<Record<Collection, { id: string }[]>>; del?: Partial<Record<Collection, string[]>> });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
