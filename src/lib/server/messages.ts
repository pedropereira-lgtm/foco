import "server-only";
import { D, MOs, WD, cap, e0, e2, fmtMin, parse, short, toMin, lisbonNow, todayISO } from "@/lib/dates";
import { eventsOn, isLate, netOf, openToday, payName } from "@/lib/logic";
import type { State, WeekMetrics } from "@/lib/types";
import { esc } from "./telegram";
import type { PlatformMonth } from "./stripe";

const app = () => process.env.APP_URL || "";

export function morningDigest(s: State, platform: PlatformMonth | null) {
  const T = todayISO();
  const d = parse(T);
  const open = openToday(s);
  const focus = open[0];
  const rest = open.slice(1, 5);
  const lines: string[] = [`<b>Foco · ${cap(WD[d.getDay()])}, ${d.getDate()} ${MOs[d.getMonth()]}</b>`, ""];
  if (focus) {
    const proj = focus.proj ? s.projects.find((p) => p.id === focus.proj)?.name : null;
    lines.push("🎯 <b>Em foco hoje</b>", `${esc(focus.t)}${proj ? ` (${esc(proj)})` : ""} · ${focus.min} min`, "");
  } else lines.push("🎯 Nada pendente para hoje. Aproveita.", "");
  if (rest.length) {
    lines.push(`📋 <b>Depois disso (${open.length - 1})</b>`);
    for (const t of rest) lines.push(`• ${esc(t.t)} · ${t.min} min${t.date < T ? " ⚠️" : ""}`);
    if (open.length - 1 > rest.length) lines.push(`• e mais ${open.length - 1 - rest.length}`);
    lines.push("");
  }
  const ev = eventsOn(s, T);
  if (ev.length) {
    lines.push("📅 <b>Agenda</b>");
    for (const e of ev) lines.push(`${e.time}  ${esc(e.t)}`);
    lines.push("");
  }
  const invoices = open.filter((t) => t.rec);
  if (invoices.length) lines.push(`🧾 Hoje há ${invoices.length} ${invoices.length === 1 ? "fatura" : "faturas"} para emitir.`, "");
  if (platform && platform.today > 1) {
    const y = platform.recv[platform.today - 1] ?? 0;
    if (y > 0) lines.push(`💶 Ontem entraram ${e2(y)} líquidos na plataforma.`);
  }
  const buttons = [[{ text: "Abrir o Foco", url: app() || "https://t.me" }]];
  if (focus) buttons.push([{ text: "✅ Marcar a 1.ª como feita", callback_data: `done:${focus.id}` } as never]);
  return { text: lines.join("\n").trim(), buttons };
}

export function invoiceMessage(s: State, taskId: string) {
  const t = s.tasks.find((x) => x.id === taskId);
  const r = t?.rec ? s.recurring.find((x) => x.id === t.rec) : null;
  if (!t || !r) return null;
  const who = s.contacts.find((c) => c.id === r.contact)?.name ?? "Cliente";
  return {
    text: `🧾 <b>Hoje é dia de faturar</b>\n${esc(who)} · ${esc(r.what)} · ${e0(r.amount)}`,
    buttons: [[{ text: "✅ Já emiti", callback_data: `done:${t.id}` }, { text: "⏰ Lembrar amanhã", callback_data: `tmr:${t.id}` }]],
  };
}

export function lateMessage(s: State, paymentId: string, days: number) {
  const p = s.payments.find((x) => x.id === paymentId);
  if (!p) return null;
  return {
    text: `⚠️ <b>Pagamento em atraso há ${days} dias</b>\n${esc(payName(s, p))} · ${esc(p.what)} · ${e2(netOf(p.gross, p.method))}\n\nCriei a tarefa para cobrares hoje.`,
    buttons: [[{ text: "✅ Já recebi", callback_data: `paid:${p.id}` }]],
  };
}

const delta = (a: number | null, b: number | null | undefined) => (a == null || b == null ? "" : a - b === 0 ? "" : ` (${a - b > 0 ? "+" : ""}${a - b} vs. semana passada)`);

export function weeklyMessage(m: WeekMetrics, prev: WeekMetrics | null) {
  const f = parse(m.from);
  const t = parse(m.to);
  const lines = [
    `📊 <b>Semana ${f.getDate()}${f.getMonth() !== t.getMonth() ? ` ${MOs[f.getMonth()]}` : ""}–${t.getDate()} ${MOs[t.getMonth()]}</b>`,
    "",
    "🔎 <b>Prospeção</b>",
    `Contactos novos: ${m.prospecting.newContacts}`,
    `Abordagens: ${m.prospecting.outreach}${delta(m.prospecting.outreach, prev?.prospecting.outreach)}`,
    `Respostas: ${m.prospecting.replies} · taxa de ${m.prospecting.replyRate}%`,
    `Propostas: ${m.prospecting.proposals} · Ganhos: ${m.prospecting.won}`,
    "",
    "✅ <b>Tarefas</b>",
    `Feitas: ${m.tasks.done} · Adiadas: ${m.tasks.postponed}`,
    `Em foco: ${fmtMin(m.tasks.focusMin)}`,
    "",
    "💶 <b>Finanças (líquido)</b>",
    m.finance.platformNet != null ? `Plataforma  ${e2(m.finance.platformNet)}  (+${m.finance.newSubs} subscritores, −${m.finance.canceledSubs})` : "Plataforma  (Stripe por ligar)",
    `Serviços    ${e2(m.finance.servicesNet)}`,
    `<b>Total       ${e2(m.finance.totalNet)}</b>`,
    `Por receber ${e0(m.finance.toReceive)}`,
  ];
  if (m.projects.stepsDone || m.projects.phasesClosed.length) {
    lines.push("", "🗂 <b>Projetos</b>", `Passos feitos: ${m.projects.stepsDone}`);
    for (const p of m.projects.phasesClosed) lines.push(`Fechou: ${esc(p)}`);
  }
  if (m.agenda.meetings) lines.push("", `📅 Reuniões: ${m.agenda.meetings} · ${String(m.agenda.hours).replace(".", ",")}h`);
  const url = process.env.APP_URL ? `${process.env.APP_URL}/semanas/imprimir?w=${m.week}` : null;
  const buttons = [[...(url ? [{ text: "📄 Ver relatório (PDF)", url }] : []), { text: "📈 Excel", callback_data: `csv:${m.week}` }]];
  return { text: lines.join("\n"), buttons };
}

export function isMorning() {
  return lisbonNow().hour >= 9;
}
export { toMin, short, D, isLate };
