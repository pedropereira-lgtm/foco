import { NextResponse } from "next/server";
import { loadState, loadWeeks } from "@/lib/server/db";
import { lastMondays } from "@/lib/server/ops";
import { platformWeeks } from "@/lib/server/stripe";
import { CSV_HEADER, computeWeek, csvRow } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const n = Math.min(52, Math.max(1, Number(url.searchParams.get("n")) || 8));
  const s = await loadState();
  const mondays = lastMondays(n);
  const stored = await loadWeeks().catch(() => []);
  let pw: Awaited<ReturnType<typeof platformWeeks>> = null;
  let stripeError: string | null = null;
  try {
    pw = await platformWeeks(mondays);
  } catch (e) {
    stripeError = (e as Error).message;
  }
  // semana atual: sempre ao vivo; anteriores: guardada se existir
  const weeks = mondays.map((m, i) => (i > 0 && stored.find((w) => w.id === m)?.data) || computeWeek(s, m, pw?.[m] ?? null));

  if (url.searchParams.get("format") === "csv") {
    const csv = "﻿" + [CSV_HEADER.join(";"), ...[...weeks].reverse().map(csvRow)].join("\n");
    return new Response(csv, {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="foco-semanas.csv"` },
    });
  }
  return NextResponse.json({ weeks, stripeError });
}
