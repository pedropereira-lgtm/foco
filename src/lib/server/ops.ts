import "server-only";
/* Ações feitas pelo servidor (botões do Telegram e cron). Espelham src/lib/actions.ts. */
import { applyOps, loadState } from "./db";
import { D, MO, addDays, iso, monday, parse, stamp, today, todayISO, uid } from "@/lib/dates";
import { missingRecTasks, newTask } from "@/lib/logic";
import type { Payment, State, Task } from "@/lib/types";

export async function completeTaskServer(id: string) {
  const s = await loadState();
  const t = s.tasks.find((x) => x.id === id);
  if (!t) return { ok: false, msg: "Esta tarefa já não existe." };
  if (t.done) return { ok: true, msg: "Já estava feita." };
  const T = todayISO();
  t.done = true;
  t.doneAt = stamp();
  t.late = t.date < T;
  if (t.late) t.date = T;
  const put: Record<string, { id: string }[]> = { tasks: [t] };
  if (t.step && t.proj) {
    const p = s.projects.find((x) => x.id === t.proj);
    const st = p?.steps.find((x) => x.id === t.step);
    if (p && st) {
      st.done = true;
      st.doneAt = stamp();
      put.projects = [p];
    }
  }
  let msg = "Feito ✅";
  if (t.rec) {
    const r = s.recurring.find((x) => x.id === t.rec);
    if (r) {
      r.issued = Math.max(r.issued, (t.k ?? 0) + 1);
      const pay: Payment = { id: uid(), contact: r.contact, what: `${r.what} · ${MO[parse(t.date).getMonth()]}`, gross: r.amount, method: r.method, date: t.date, status: "previsto", rec: r.id, fromTask: t.id, createdAt: stamp() };
      s.payments.push(pay);
      put.recurring = [r];
      put.payments = [pay];
      const next = missingRecTasks(s);
      put.tasks = [t, ...next];
      msg = `Fatura marcada como emitida. ${r.amount} € por receber.`;
    }
  }
  await applyOps({ put });
  return { ok: true, msg };
}

export async function snoozeTaskServer(id: string) {
  const s = await loadState();
  const t = s.tasks.find((x) => x.id === id);
  if (!t) return { ok: false, msg: "Esta tarefa já não existe." };
  t.date = D(1);
  t.snoozedAt = [...(t.snoozedAt ?? []), stamp()];
  await applyOps({ put: { tasks: [t] } });
  return { ok: true, msg: "Passou para amanhã ⏰" };
}

export async function markPaidServer(id: string) {
  const s = await loadState();
  const p = s.payments.find((x) => x.id === id);
  if (!p) return { ok: false, msg: "Este pagamento já não existe." };
  p.status = "pago";
  p.paidAt = stamp();
  p.date = todayISO();
  const chase = s.tasks.filter((t) => t.chase === id && !t.done).map((t) => ({ ...t, done: true, doneAt: stamp() }));
  await applyOps({ put: { payments: [p], tasks: chase } });
  return { ok: true, msg: "Marcado como recebido 💶" };
}

export async function createChaseTask(s: State, p: Payment, who: string): Promise<Task> {
  const t = newTask(`Cobrar ${p.gross} € a ${who}`, todayISO(), { lead: p.contact ?? undefined, chase: p.id, min: 5 });
  p.chased = true;
  await applyOps({ put: { tasks: [t], payments: [p] } });
  s.tasks.push(t);
  return t;
}

export async function ensureRecurringServer(s: State) {
  const next = missingRecTasks(s);
  if (next.length) {
    s.tasks.push(...next);
    await applyOps({ put: { tasks: next } });
  }
  return next.length;
}

/** Segunda-feira da semana atual e das N anteriores (mais recente primeiro). */
export function lastMondays(n: number) {
  const m = monday(today());
  return [...Array(n)].map((_, i) => iso(addDays(m, -7 * i)));
}
