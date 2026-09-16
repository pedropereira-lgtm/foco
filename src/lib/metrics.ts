import { addDays, iso, parse, todayISO } from "./dates";
import { PHASES, eventsOn, netOf } from "./logic";
import type { ISODate, State, WeekMetrics } from "./types";

export interface PlatformRange {
  net: number;
  newSubs: number;
  canceledSubs: number;
}

/** Lisboa: converte um timestamp ISO para a data local YYYY-MM-DD. */
export const dayOf = (stampIso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(stampIso));

const inRange = (d: string | undefined, from: ISODate, to: ISODate) => !!d && d >= from && d <= to;

export function weekRange(mondayIso: ISODate) {
  return { from: mondayIso, to: iso(addDays(parse(mondayIso), 6)) };
}

export function computeWeek(s: State, mondayIso: ISODate, platform: PlatformRange | null): WeekMetrics {
  const { from, to } = weekRange(mondayIso);
  const hist = s.deals.flatMap((d) => (d.history ?? []).map((h) => ({ ...h, day: dayOf(h.at) })));
  const count = (stage: string) => hist.filter((h) => h.stage === stage && inRange(h.day, from, to)).length;
  const outreach = count("contactado");
  const replies = count("conversa");

  const doneTasks = s.tasks.filter((t) => t.doneAt && inRange(dayOf(t.doneAt), from, to));
  const follow = doneTasks.filter((t) => t.lead && !t.rec && !t.chase);
  const focusMin = s.tasks.reduce((a, t) => a + (t.focusLog ?? []).filter((l) => inRange(dayOf(l.at), from, to)).reduce((x, l) => x + l.min, 0), 0);
  const postponed = s.tasks.reduce((a, t) => a + (t.snoozedAt ?? []).filter((x) => inRange(dayOf(x), from, to)).length, 0);

  const paidIn = s.payments.filter((p) => p.status === "pago" && inRange(p.paidAt ? dayOf(p.paidAt) : p.date, from, to));
  const servicesNet = paidIn.reduce((a, p) => a + netOf(p.gross, p.method), 0);
  const toReceive = s.payments.filter((p) => p.status === "previsto").reduce((a, p) => a + netOf(p.gross, p.method), 0);

  const stepsDone = s.projects.reduce((a, p) => a + p.steps.filter((x) => x.doneAt && inRange(dayOf(x.doneAt), from, to)).length, 0);
  const phasesClosed: string[] = [];
  for (const p of s.projects) {
    PHASES.forEach((ph, i) => {
      const ss = p.steps.filter((x) => x.ph === i);
      if (!ss.length || !ss.every((x) => x.done && x.doneAt)) return;
      const last = ss.map((x) => x.doneAt!).sort().pop()!;
      if (inRange(dayOf(last), from, to)) phasesClosed.push(`${p.name}: ${ph}`);
    });
  }

  let meetings = 0;
  let minutes = 0;
  for (let i = 0; i < 7; i++) {
    const k = iso(addDays(parse(from), i));
    if (k > todayISO()) break;
    for (const e of eventsOn(s, k)) {
      if (e.cat !== "trabalho") continue;
      meetings++;
      minutes += e.dur || 60;
    }
  }

  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    week: mondayIso,
    from,
    to,
    prospecting: {
      newContacts: s.contacts.filter((c) => inRange(dayOf(c.createdAt), from, to)).length,
      outreach,
      replies,
      replyRate: outreach ? Math.round((replies / outreach) * 100) : 0,
      proposals: count("proposta"),
      won: count("ganho"),
    },
    tasks: {
      done: doneTasks.length,
      postponed,
      focusMin,
      followupsOnTime: follow.filter((t) => !t.late).length,
      followupsLate: follow.filter((t) => t.late).length,
    },
    finance: {
      platformNet: platform ? round(platform.net) : null,
      newSubs: platform ? platform.newSubs : null,
      canceledSubs: platform ? platform.canceledSubs : null,
      servicesNet: round(servicesNet),
      totalNet: round((platform?.net ?? 0) + servicesNet),
      toReceive: round(toReceive),
    },
    projects: { stepsDone, phasesClosed },
    agenda: { meetings, hours: Math.round((minutes / 60) * 10) / 10 },
  };
}

export const CSV_HEADER = [
  "Semana (segunda)", "Até", "Contactos novos", "Abordagens", "Respostas", "Taxa de resposta %", "Propostas", "Ganhos",
  "Tarefas feitas", "Adiadas", "Minutos em foco", "Follow-ups a tempo", "Follow-ups atrasados",
  "StudyHub líquido €", "Subscritores novos", "Cancelamentos", "Serviços líquido €", "Total líquido €", "Por receber €",
  "Passos de projeto", "Fases fechadas", "Reuniões", "Horas de reunião",
];

export function csvRow(m: WeekMetrics) {
  const n = (x: number | null) => (x == null ? "" : String(x).replace(".", ","));
  return [
    m.from, m.to, m.prospecting.newContacts, m.prospecting.outreach, m.prospecting.replies, m.prospecting.replyRate, m.prospecting.proposals, m.prospecting.won,
    m.tasks.done, m.tasks.postponed, m.tasks.focusMin, m.tasks.followupsOnTime, m.tasks.followupsLate,
    n(m.finance.platformNet), n(m.finance.newSubs), n(m.finance.canceledSubs), n(m.finance.servicesNet), n(m.finance.totalNet), n(m.finance.toReceive),
    m.projects.stepsDone, `"${m.projects.phasesClosed.join("; ").replace(/"/g, "'")}"`, m.agenda.meetings, n(m.agenda.hours),
  ].join(";");
}
