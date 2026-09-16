/* Regras do Foco partilhadas entre a app (browser) e o servidor (cron, Telegram). Sem DOM. */
import { D, WD, WDs, addDays, cap, iso, parse, pad, rel, today, todayISO, uid, stamp } from "./dates";
import type { CalEvent, Contact, Deal, ISODate, PayMethod, Payment, Project, Recurring, Stage, State, Svc, Task } from "./types";

export const PHASES = ["Briefing", "Protótipo", "Desenvolvimento", "Revisão", "Entrega"];
export const STAGES: { k: Stage; n: string }[] = [
  { k: "ideia", n: "Quero contactar" },
  { k: "contactado", n: "Contactado" },
  { k: "conversa", n: "Em conversa" },
  { k: "proposta", n: "Proposta enviada" },
  { k: "ganho", n: "Ganho" },
];
export const stageName = (k: Stage) => STAGES.find((s) => s.k === k)?.n ?? k;
export const SVC: Record<Svc, string> = { site: "Website", ia: "Automação IA", pack: "Pack" };
export const ORIGINS = ["Instagram", "LinkedIn", "Email", "Indicação", "Outro"];
export const CH: Record<string, string> = { Instagram: "IG", LinkedIn: "in", Email: "@", Indicação: "ind", Outro: "—" };
export const METHODS: PayMethod[] = ["Transferência", "MB Way", "Stripe", "Dinheiro"];
export const VIAS = ["Instagram", "LinkedIn", "Email", "Chamada", "Reunião"];

/* ── projetos ───────────────────────────────────────── */
export const TPL: Record<Svc, [number, string][]> = {
  site: [[0, "Enviar questionário de briefing"], [0, "Receber textos, fotos e logótipo"], [1, "Criar protótipo da página inicial"], [1, "Validar protótipo com o cliente"], [2, "Construir as páginas"], [2, "Formulário de contacto e SEO básico"], [3, "Testar no telemóvel"], [3, "Enviar link de revisão ao cliente"], [4, "Ligar domínio e publicar"], [4, "Emitir fatura final"]],
  ia: [[0, "Mapear o processo atual com o cliente"], [0, "Pedir acessos às ferramentas"], [1, "Desenhar o fluxo da automação"], [1, "Validar o fluxo com o cliente"], [2, "Construir a automação"], [2, "Ligar às ferramentas do cliente"], [3, "Testar com casos reais"], [3, "Ajustar com o feedback"], [4, "Pôr a funcionar"], [4, "Gravar vídeo curto a explicar"], [4, "Emitir fatura final"]],
  pack: [[0, "Enviar questionário de briefing"], [0, "Mapear o processo a automatizar"], [0, "Receber conteúdos e acessos"], [1, "Criar protótipo do site"], [1, "Desenhar o fluxo da automação"], [1, "Validar tudo com o cliente"], [2, "Construir o site"], [2, "Construir a automação e ligar ao site"], [3, "Testar no telemóvel e com casos reais"], [3, "Enviar link de revisão ao cliente"], [4, "Publicar site e ligar automação"], [4, "Emitir fatura final"]],
};
export const buildSteps = (svc: Svc) => TPL[svc].map(([ph, t]) => ({ id: uid(), ph, t, done: false }));
export const phaseOf = (p: Project) => {
  const i = PHASES.findIndex((_, k) => p.steps.some((s) => s.ph === k && !s.done));
  return i < 0 ? PHASES.length - 1 : i;
};
export const allDone = (p: Project) => p.steps.length > 0 && p.steps.every((s) => s.done);

/* ── contactos e pipeline ───────────────────────────── */
export const newContact = (name: string): Contact => ({
  id: uid(), name, person: "", email: "", phone: "", site: "", social: "", nif: "", address: "", origin: "Outro", summary: "", notes: [], createdAt: stamp(),
});
export const newDeal = (contact: string, svc: Svc = "site"): Deal => ({
  id: uid(), contact, svc, val: null, stage: "ideia", history: [{ stage: "ideia", at: stamp() }], createdAt: stamp(),
});
export const dealOf = (s: State, cid: string) => s.deals.find((d) => d.contact === cid && d.stage !== "ganho");
export const wonOf = (s: State, cid: string) => s.deals.find((d) => d.contact === cid && d.stage === "ganho");
export const paysOf = (s: State, cid: string) => s.payments.filter((p) => p.contact === cid);
export function statusOf(s: State, c: Contact): "cliente" | "pipeline" | "contacto" {
  if (wonOf(s, c.id) || s.recurring.some((r) => r.contact === c.id) || s.projects.some((p) => p.lead === c.id) || paysOf(s, c.id).some((p) => p.status === "pago")) return "cliente";
  if (dealOf(s, c.id)) return "pipeline";
  return "contacto";
}
export const nextFollow = (s: State, cid: string) =>
  s.tasks.filter((t) => t.lead === cid && !t.done && !t.rec && !t.chase).sort((a, b) => (a.date < b.date ? -1 : 1))[0];
export const initials = (n: string) =>
  (n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

/* ── tarefas ────────────────────────────────────────── */
export const newTask = (t: string, date: ISODate, extra: Partial<Task> = {}): Task => ({
  id: uid(), t, min: 15, date, done: false, createdAt: stamp(), ...extra,
});
export const openToday = (s: State) =>
  s.tasks.filter((t) => !t.done && t.date <= todayISO()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

/* ── dinheiro ───────────────────────────────────────── */
/** Estimativa da comissão Stripe para pagamentos registados à mão (UE, cartão standard). */
export const stripeFee = (g: number) => Math.round((g * 0.015 + 0.25) * 100) / 100;
export const netOf = (g: number, method: PayMethod) => (method === "Stripe" ? g - stripeFee(g) : g);
export const isLate = (p: Payment) => p.status === "previsto" && p.date < todayISO();
export const payName = (s: State, p: Payment) => s.contacts.find((c) => c.id === p.contact)?.name || p.client || "Sem cliente";

/* ── mensalidades ───────────────────────────────────── */
export function occDate(r: Pick<Recurring, "start" | "day">, k: number): ISODate {
  const s = parse(r.start);
  const last = new Date(s.getFullYear(), s.getMonth() + k + 1, 0).getDate();
  return iso(new Date(s.getFullYear(), s.getMonth() + k, Math.min(r.day, last)));
}
/** Devolve as tarefas de faturação que faltam criar (uma pendente por mensalidade). */
export function missingRecTasks(s: State): Task[] {
  const out: Task[] = [];
  for (const r of s.recurring) {
    if (s.tasks.some((t) => t.rec === r.id && !t.done)) continue;
    out.push(newTask(`Emitir fatura: ${r.what}`, occDate(r, r.issued), { lead: r.contact, rec: r.id, k: r.issued, min: 10 }));
  }
  return out;
}

/* ── eventos ────────────────────────────────────────── */
export const REPS: [CalEvent["rep"], string][] = [["none", "Não repete"], ["daily", "Todos os dias"], ["weekdays", "Dias úteis"], ["days", "Dias à escolha"], ["weekly", "Todas as semanas"]];
export const DURS: [number, string][] = [[30, "30 min"], [60, "1h"], [90, "1h30"], [120, "2h"]];
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const isRec = (e: Pick<CalEvent, "rep">) => !!e.rep && e.rep !== "none";
export function occurs(e: CalEvent, k: ISODate) {
  if (k < e.date || e.skip?.includes(k)) return false;
  const w = parse(k).getDay();
  switch (e.rep) {
    case "daily": return true;
    case "weekdays": return w > 0 && w < 6;
    case "days": return (e.days || []).includes(w);
    case "weekly": return w === parse(e.date).getDay();
    default: return k === e.date;
  }
}
export type EventOcc = CalEvent & { on: ISODate };
export const eventsOn = (s: State, k: ISODate): EventOcc[] =>
  s.events.filter((e) => occurs(e, k)).map((e) => ({ ...e, on: k })).sort((a, b) => (a.time < b.time ? -1 : 1));
export function repText(e: Pick<CalEvent, "rep" | "days" | "date">) {
  switch (e.rep) {
    case "daily": return "todos os dias";
    case "weekdays": return "dias úteis";
    case "days": {
      const ds = WEEK_ORDER.filter((d) => (e.days || []).includes(d)).map((d) => WDs[d]);
      return ds.length ? `às ${ds.join(", ")}` : "escolhe os dias";
    }
    case "weekly": {
      const d = parse(e.date).getDay();
      return d === 0 || d === 6 ? `todos os ${WD[d]}s` : `todas as ${WD[d]}s`;
    }
    default: return "";
  }
}
const DAYTOK: Record<string, number> = { dom: 0, domingo: 0, domingos: 0, seg: 1, segunda: 1, segundas: 1, ter: 2, "terça": 2, terca: 2, "terças": 2, tercas: 2, qua: 3, quarta: 3, quartas: 3, qui: 4, quinta: 4, quintas: 4, sex: 5, sexta: 5, sextas: 5, "sáb": 6, sab: 6, "sábado": 6, sabado: 6, "sábados": 6, sabados: 6 };
/** Percebe frases como "treino seg qua sex 19h" ou "chamada Ricardo amanhã às 10h30". */
export function parseEvent(txt: string) {
  const out: Partial<{ time: string; dur: number; rep: CalEvent["rep"]; days: number[]; date: ISODate; title: string }> = {};
  let s = " " + txt + " ";
  const tm = s.match(/(?:\s(?:às|as)\s+)?\s(\d{1,2})\s*(?:h|:)\s*(\d{2})?(?=[\s,.]|$)/i) || s.match(/\s(?:às|as)\s+(\d{1,2})(?=[\s,.]|$)()/i);
  if (tm && +tm[1] < 24) {
    out.time = `${pad(+tm[1])}:${tm[2] || "00"}`;
    s = s.replace(tm[0], " ");
  }
  const dm = s.match(/\s(\d{2,3})\s*min(?:utos)?(?=[\s,.]|$)/i);
  if (dm) {
    out.dur = +dm[1];
    s = s.replace(dm[0], " ");
  }
  const rules: [RegExp, CalEvent["rep"]][] = [[/\s(todos os dias|diariamente)(?=\s|$)/i, "daily"], [/\s(dias [úu]teis)(?=\s|$)/i, "weekdays"], [/\s(todas as semanas|semanalmente)(?=\s|$)/i, "weekly"]];
  for (const [re, rep] of rules) {
    if (re.test(s)) { out.rep = rep; s = s.replace(re, " "); break; }
  }
  if (/\samanh[ãa](?=\s|$)/i.test(s)) { out.date = D(1); s = s.replace(/\samanh[ãa](?=\s|$)/i, " "); }
  else if (/\shoje(?=\s|$)/i.test(s)) { out.date = todayISO(); s = s.replace(/\shoje(?=\s|$)/i, " "); }
  const days: number[] = [];
  s = s.split(/(\s+|,)/).filter((w) => {
    const k = w.toLowerCase();
    if (k in DAYTOK) { if (!days.includes(DAYTOK[k])) days.push(DAYTOK[k]); return false; }
    return true;
  }).join("");
  if (days.length && !out.rep) {
    if (days.length > 1 || /\stod[ao]s\s/i.test(s)) { out.rep = "days"; out.days = days; }
    else { let i = 1; while (addDays(today(), i).getDay() !== days[0]) i++; out.date = D(i); }
  }
  out.title = cap(s.replace(/\s(tod[ao]s|às|as|e|a|ao|à)(?=[\s,]*$)/gi, " ").replace(/\s(às|as|,)\s*(?=\s|$)/gi, " ").replace(/[\s,]+/g, " ").trim());
  return out;
}

export { rel };
