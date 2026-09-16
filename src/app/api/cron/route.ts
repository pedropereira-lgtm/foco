import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/server/auth";
import { loadState, saveSettings, saveWeek } from "@/lib/server/db";
import { send } from "@/lib/server/telegram";
import { createChaseTask, ensureRecurringServer, lastMondays } from "@/lib/server/ops";
import { invoiceMessage, lateMessage, morningDigest, weeklyMessage } from "@/lib/server/messages";
import { platformMonth, platformWeeks, type PlatformMonth } from "@/lib/server/stripe";
import { computeWeek } from "@/lib/metrics";
import { diff, lisbonNow } from "@/lib/dates";
import { payName } from "@/lib/logic";

export const dynamic = "force-dynamic";

/*
 * Chamado de hora a hora (Netlify Scheduled Function). Cada passo só corre uma vez
 * quando deve, por isso é seguro chamar mais vezes.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? new URL(req.url).searchParams.get("key");
  if (!safeEqual(auth, process.env.CRON_SECRET)) return NextResponse.json({ error: "Sem acesso." }, { status: 401 });

  const now = lisbonNow();
  const s = await loadState();
  const chat = s.settings.telegramChatId;
  const log: string[] = [];

  // 1. mensalidades: a próxima tarefa de faturação existe sempre
  const created = await ensureRecurringServer(s);
  if (created) log.push(`mensalidades: ${created} tarefas criadas`);

  // 2. pagamentos atrasados há 3+ dias: tarefa para cobrar (uma vez)
  for (const p of s.payments) {
    if (p.status !== "previsto" || p.chased) continue;
    const late = -diff(p.date);
    if (late < 3) continue;
    await createChaseTask(s, p, payName(s, p));
    log.push(`cobrança criada: ${p.id}`);
    if (chat) {
      const m = lateMessage(s, p.id, late);
      if (m) await send(chat, m.text, m.buttons);
    }
  }

  // 3. resumo da manhã às 9h (e faturas do dia)
  if (chat && now.hour >= 9 && s.settings.lastDigest !== now.date) {
    const pm = await platformMonth();
    const d = morningDigest(s, "recv" in pm ? (pm as PlatformMonth) : null);
    await send(chat, d.text, d.buttons);
    for (const t of s.tasks.filter((x) => x.rec && !x.done && x.date === now.date)) {
      const m = invoiceMessage(s, t.id);
      if (m) await send(chat, m.text, m.buttons);
    }
    await saveSettings({ lastDigest: now.date });
    log.push("resumo da manhã enviado");
  }

  // 4. sexta às 18h: resumo semanal + guarda a semana
  if (now.dow === 5 && now.hour >= 18 && s.settings.lastWeekly !== now.date) {
    const [cur, prev] = lastMondays(2);
    const pw = await platformWeeks([cur, prev]).catch(() => null);
    const m = computeWeek(s, cur, pw?.[cur] ?? null);
    await saveWeek({ id: cur, data: m });
    if (chat) {
      const w = weeklyMessage(m, computeWeek(s, prev, pw?.[prev] ?? null));
      await send(chat, w.text, w.buttons);
    }
    await saveSettings({ lastWeekly: now.date });
    log.push("resumo semanal enviado");
  }

  // 5. segunda de manhã: fecha a semana anterior com os números finais
  if (now.dow === 1 && now.hour >= 6) {
    const [, prev] = lastMondays(2);
    const pw = await platformWeeks([prev]).catch(() => null);
    await saveWeek({ id: prev, data: computeWeek(s, prev, pw?.[prev] ?? null) });
  }

  return NextResponse.json({ ok: true, at: now, log });
}
