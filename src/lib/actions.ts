"use client";
/* Tudo o que muda dados passa por aqui: altera o estado, grava e avisa. */
import { foco } from "./store";
import { D, MO, parse, rel, short, stamp, todayISO, uid } from "./dates";
import { PHASES, SVC, buildSteps, dealOf, missingRecTasks, newContact, newDeal, newTask, occDate, openToday, phaseOf, allDone, stageName, wonOf } from "./logic";
import type { CalEvent, Contact, Deal, Expense, Goal, Note, PayMethod, Payment, Project, Recurring, Stage, Svc, Task } from "./types";

const S = () => foco.s;
const T = () => todayISO();
const done = () => foco.emit();

/* ── tarefas ────────────────────────────────────────── */
export function addTask(t: string, date = T(), extra: Partial<Task> = {}) {
  const task = newTask(t, date, { order: Date.now(), ...extra });
  S().tasks.push(task);
  foco.save("tasks", task);
  done();
  return task;
}

function afterPhase(p: Project, prev: number) {
  if (allDone(p)) return foco.toast(`${p.name}: tudo feito. Pronto para entregar.`);
  const now = phaseOf(p);
  if (now > prev) foco.toast(`Fase de ${PHASES[prev]} fechada. ${p.name} passou para ${PHASES[now]}.`);
}

function syncStep(t: Task, val: boolean) {
  if (!t.step || !t.proj) return;
  const p = S().projects.find((x) => x.id === t.proj);
  const s = p?.steps.find((x) => x.id === t.step);
  if (p && s) {
    s.done = val;
    s.doneAt = val ? stamp() : undefined;
    foco.save("projects", p);
  }
}

export function completeTask(id: string) {
  const t = S().tasks.find((x) => x.id === id);
  if (!t || t.done) return;
  const wasFocus = openToday(S())[0]?.id === id;
  const proj = t.step ? S().projects.find((p) => p.id === t.proj) : undefined;
  const prev = proj ? phaseOf(proj) : 0;
  t.done = true;
  t.doneAt = stamp();
  t.late = t.date < T();
  if (t.late) t.date = T();
  syncStep(t, true);
  foco.save("tasks", t);
  if (wasFocus) {
    const n = openToday(S())[0];
    foco.toast(n ? `Feito. A seguir: ${n.t}` : "Feito. Dia fechado.");
  }
  if (proj) afterPhase(proj, prev);
  if (t.rec) {
    const r = S().recurring.find((x) => x.id === t.rec);
    if (r) {
      r.issued = Math.max(r.issued, (t.k ?? 0) + 1);
      foco.save("recurring", r);
      const pay: Payment = { id: uid(), contact: r.contact, what: `${r.what} · ${MO[parse(t.date).getMonth()]}`, gross: r.amount, method: r.method, date: t.date, status: "previsto", rec: r.id, fromTask: t.id, createdAt: stamp() };
      S().payments.push(pay);
      foco.save("payments", pay);
      ensureRecurringTasks();
      foco.toast(`Fatura emitida. Ficou ${r.amount} € por receber e a próxima tarefa aparece a ${short(occDate(r, r.issued))}.`);
    }
  }
  done();
}

export function uncompleteTask(id: string) {
  const t = S().tasks.find((x) => x.id === id);
  if (!t) return;
  t.done = false;
  t.doneAt = undefined;
  syncStep(t, false);
  foco.save("tasks", t);
  if (t.rec) {
    const r = S().recurring.find((x) => x.id === t.rec);
    if (r) {
      r.issued = t.k ?? 0;
      foco.save("recurring", r);
      const pays = S().payments.filter((p) => p.fromTask === t.id).map((p) => p.id);
      if (pays.length) foco.remove("payments", pays);
      const extra = S().tasks.filter((x) => x.rec === r.id && !x.done && x.id !== t.id).map((x) => x.id);
      if (extra.length) foco.remove("tasks", extra);
    }
  }
  done();
}

export function snoozeTask(id: string) {
  rescheduleTask(id, D(1));
}

/** Adia (ou antecipa) uma tarefa para um dia à escolha. */
export function rescheduleTask(id: string, date: string, quiet = false) {
  const t = S().tasks.find((x) => x.id === id);
  if (!t || !date) return;
  const later = date > t.date;
  t.date = date;
  if (later) t.snoozedAt = [...(t.snoozedAt ?? []), stamp()];
  foco.save("tasks", t);
  if (!quiet) {
    const base = date === D(1) ? "Passou para amanhã. Sem culpa." : `Passou para ${rel(date)}.`;
    foco.toast(t.due && date > t.due ? `${base} Atenção: é depois do prazo (${rel(t.due)}).` : base);
  }
  done();
}

export function setTaskDue(id: string, due: string | null) {
  const t = S().tasks.find((x) => x.id === id);
  if (!t) return;
  if (due) t.due = due;
  else delete t.due;
  foco.save("tasks", t);
  done();
}

export function promoteTask(id: string) {
  const t = S().tasks.find((x) => x.id === id);
  if (!t) return;
  const min = Math.min(0, ...openToday(S()).map((x) => x.order ?? 0));
  t.order = min - 1;
  foco.save("tasks", t);
  done();
}

export function addFocusMinutes(id: string, min: number) {
  const t = S().tasks.find((x) => x.id === id);
  if (!t || min <= 0) return;
  t.focusLog = [...(t.focusLog ?? []), { at: stamp(), min }];
  foco.save("tasks", t);
}

export function deleteTask(id: string) {
  foco.remove("tasks", id);
  done();
}

/* ── mente ──────────────────────────────────────────── */
export function addInbox(t: string) {
  const i = { id: uid(), t, createdAt: stamp() };
  S().inbox.unshift(i);
  foco.save("inbox", i);
  done();
}
export function inboxTo(id: string, to: "task" | "contact" | "delete") {
  const i = S().inbox.find((x) => x.id === id);
  if (!i) return;
  foco.remove("inbox", id);
  if (to === "task") {
    addTask(i.t);
    foco.toast("Passou a tarefa de hoje.");
  } else if (to === "contact") {
    const c = newContact(i.t);
    S().contacts.push(c);
    foco.save("contacts", c);
    foco.toast("Guardado em Contactos.");
  }
  done();
}

/* ── contactos e pipeline ───────────────────────────── */
export function createContact(name = "") {
  const c = newContact(name);
  S().contacts.push(c);
  if (name) foco.save("contacts", c);
  done();
  return c;
}
export function updateContact(c: Contact, patch: Partial<Contact>) {
  Object.assign(c, patch);
  if (c.name.trim()) foco.save("contacts", c);
  done();
}
export function deleteContact(id: string) {
  const c = S().contacts.find((x) => x.id === id);
  if (!c) return;
  foco.remove("deals", S().deals.filter((d) => d.contact === id).map((d) => d.id));
  foco.remove("tasks", S().tasks.filter((t) => t.lead === id && !t.done).map((t) => t.id));
  foco.remove("recurring", S().recurring.filter((r) => r.contact === id).map((r) => r.id));
  S().projects.filter((p) => p.lead === id).forEach((p) => { p.lead = null; foco.save("projects", p); });
  S().payments.filter((p) => p.contact === id).forEach((p) => { p.client = c.name; p.contact = null; foco.save("payments", p); });
  foco.remove("contacts", id);
  foco.sheet = null;
  foco.toast(`${c.name} foi apagado.`);
  done();
}
export function toPipeline(cid: string) {
  const c = S().contacts.find((x) => x.id === cid);
  if (!c) return;
  if (!c.name.trim()) return foco.toast("Dá primeiro um nome ao contacto.");
  if (!S().contacts.includes(c)) return;
  foco.save("contacts", c);
  const last = S().deals.filter((d) => d.contact === cid).pop();
  const d = newDeal(cid, last?.svc ?? "site");
  S().deals.push(d);
  foco.save("deals", d);
  foco.toast(`${c.name} está na Pipeline, em “Quero contactar”.`);
  done();
}
export function moveDeal(id: string, stage: Stage) {
  const d = S().deals.find((x) => x.id === id);
  if (!d || d.stage === stage) return;
  const c = S().contacts.find((x) => x.id === d.contact);
  const from = ["ideia", "contactado", "conversa", "proposta", "ganho"].indexOf(d.stage);
  d.stage = stage;
  d.history = [...(d.history ?? []), { stage, at: stamp() }];
  foco.save("deals", d);
  const name = c?.name ?? "Contacto";
  if (stage === "contactado" && from < 1 && c) {
    addTask(`Seguir com ${c.person || c.name}`, D(3), { lead: c.id, min: 5 });
    foco.toast(`Contactado. Lembrete criado para ${rel(D(3))}.`);
  } else if (stage === "ganho" && c) {
    foco.toast(`${name} é agora cliente.`);
    if (!S().projects.some((p) => p.lead === c.id)) openProjectFromContact(c.id);
  } else foco.toast(`${name} passou para “${stageName(stage)}”.`);
  done();
}
export function updateDeal(d: Deal, patch: Partial<Deal>) {
  Object.assign(d, patch);
  foco.save("deals", d);
  done();
}
export function removeDeal(id: string) {
  foco.remove("deals", id);
  foco.toast("Saiu da pipeline. O contacto continua guardado.");
  done();
}
export function followTomorrow(cid: string) {
  const c = S().contacts.find((x) => x.id === cid);
  if (!c) return;
  addTask(`Seguir com ${c.person || c.name}`, D(1), { lead: cid, min: 5 });
  foco.toast("Lembrete criado para amanhã.");
}

/* ── notas ──────────────────────────────────────────── */
type WithNotes = { notes: Note[]; summary: string };
const saveOwner = (kind: "contact" | "project", o: WithNotes & { id: string }) =>
  kind === "contact" ? foco.save("contacts", o as Contact) : foco.save("projects", o as Project);
export function setSummary(kind: "contact" | "project", o: WithNotes & { id: string }, v: string) {
  o.summary = v;
  saveOwner(kind, o);
}
export function addNote(kind: "contact" | "project", o: WithNotes & { id: string }, t: string, via: string) {
  o.notes = [{ id: uid(), date: T(), via, t }, ...(o.notes ?? [])];
  saveOwner(kind, o);
  foco.toast("Nota guardada.");
  done();
}
export function deleteNote(kind: "contact" | "project", o: WithNotes & { id: string }, id: string) {
  o.notes = o.notes.filter((n) => n.id !== id);
  saveOwner(kind, o);
  done();
}

/* ── projetos ───────────────────────────────────────── */
export function openProjectFromContact(cid: string) {
  const c = S().contacts.find((x) => x.id === cid);
  if (!c) return;
  const d = wonOf(S(), cid) || dealOf(S(), cid);
  const svc = d?.svc ?? "site";
  foco.open({ kind: "newProject", name: `${svc === "ia" ? "Automação" : svc === "pack" ? "Pack" : "Site"} ${c.name}`, client: (c.person ? `${c.person} · ` : "") + c.name, svc, lead: cid });
}
export function createProject(data: { name: string; client: string; svc: Svc; due: string | null; lead: string | null }) {
  const p: Project = { id: uid(), name: data.name, client: data.client || data.name, kind: SVC[data.svc], svc: data.svc, lead: data.lead, due: data.due, summary: "", notes: [], steps: buildSteps(data.svc), createdAt: stamp() };
  S().projects.unshift(p);
  foco.save("projects", p);
  foco.toast(`Projeto criado. Primeiro passo: ${p.steps[0].t}`);
  done();
  return p;
}
export function toggleStep(p: Project, sid: string) {
  const prev = phaseOf(p);
  const s = p.steps.find((x) => x.id === sid);
  if (!s) return;
  s.done = !s.done;
  s.doneAt = s.done ? stamp() : undefined;
  foco.save("projects", p);
  S().tasks.filter((t) => t.step === sid).forEach((t) => {
    t.done = s.done;
    t.doneAt = s.done ? stamp() : undefined;
    foco.save("tasks", t);
  });
  if (s.done) afterPhase(p, prev);
  done();
}
export function addStep(p: Project, t: string) {
  p.steps.push({ id: uid(), ph: phaseOf(p), t, done: false });
  foco.save("projects", p);
  done();
}
export function focusStep(p: Project, sid: string) {
  const s = p.steps.find((x) => x.id === sid);
  if (!s) return;
  let t = S().tasks.find((x) => x.step === sid && !x.done);
  if (t) t.date = T();
  else {
    t = newTask(s.t, T(), { proj: p.id, step: sid, min: 25 });
    S().tasks.push(t);
  }
  t.order = Math.min(0, ...openToday(S()).map((x) => x.order ?? 0)) - 1;
  foco.save("tasks", t);
  foco.toast(`Em foco: ${s.t}`);
  done();
}
export function updateProject(p: Project, patch: Partial<Project>) {
  Object.assign(p, patch);
  foco.save("projects", p);
  done();
}
export function deleteProject(id: string) {
  foco.remove("tasks", S().tasks.filter((t) => t.proj === id && !t.done).map((t) => t.id));
  foco.remove("projects", id);
  foco.sheet = null;
  foco.toast("Projeto apagado.");
  done();
}

/* ── eventos ────────────────────────────────────────── */
export function saveEvent(data: Omit<CalEvent, "id" | "skip" | "createdAt">, id?: string) {
  if (id) {
    const e = S().events.find((x) => x.id === id);
    if (e) {
      Object.assign(e, data);
      foco.save("events", e);
    }
    foco.toast("Evento atualizado.");
  } else {
    const e: CalEvent = { id: uid(), skip: [], createdAt: stamp(), ...data };
    S().events.push(e);
    foco.save("events", e);
    foco.toast(`Evento marcado: ${e.t}, às ${e.time}.`);
  }
  done();
}
export function skipEvent(id: string, on: string) {
  const e = S().events.find((x) => x.id === id);
  if (!e) return;
  e.skip = [...(e.skip ?? []), on];
  foco.save("events", e);
  foco.toast(`${e.t} tirado de ${rel(on)}.`);
  done();
}
export function deleteEvent(id: string) {
  foco.remove("events", id);
  foco.toast("Evento apagado.");
  done();
}

/* ── pagamentos e mensalidades ──────────────────────── */
function contactByName(name: string) {
  let c = S().contacts.find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (!c) {
    c = newContact(name);
    S().contacts.push(c);
    foco.save("contacts", c);
  }
  return c;
}
export function addPayment(d: { client: string; what: string; gross: number; method: PayMethod; date: string; status: "pago" | "previsto" }) {
  const c = contactByName(d.client);
  const p: Payment = { id: uid(), contact: c.id, what: d.what || "Pagamento", gross: d.gross, method: d.method, date: d.date, status: d.status, paidAt: d.status === "pago" ? stamp() : undefined, createdAt: stamp() };
  S().payments.push(p);
  foco.save("payments", p);
  foco.toast(d.status === "pago" ? "Pagamento registado." : `Guardado como previsto para ${rel(d.date)}.`);
  done();
  return c;
}
export function markPaid(id: string) {
  const p = S().payments.find((x) => x.id === id);
  if (!p) return;
  p.status = "pago";
  p.paidAt = stamp();
  p.date = T();
  foco.save("payments", p);
  S().tasks.filter((t) => t.chase === id && !t.done).forEach((t) => { t.done = true; t.doneAt = stamp(); foco.save("tasks", t); });
  foco.toast("Marcado como recebido.");
  done();
}
export function deletePayment(id: string) {
  foco.remove("payments", id);
  done();
}
export function ensureRecurringTasks() {
  for (const t of missingRecTasks(S())) {
    S().tasks.push(t);
    foco.save("tasks", t);
  }
}
export function createRecurring(d: { client: string; what: string; amount: number; method: PayMethod; start: string; issued: boolean }) {
  const c = contactByName(d.client);
  const r: Recurring = { id: uid(), contact: c.id, what: d.what || "Mensalidade", amount: d.amount, method: d.method, start: d.start, day: parse(d.start).getDate(), issued: d.issued ? 1 : 0, createdAt: stamp() };
  S().recurring.push(r);
  foco.save("recurring", r);
  if (d.issued) {
    const p: Payment = { id: uid(), contact: c.id, what: `${r.what} · ${MO[parse(d.start).getMonth()]}`, gross: d.amount, method: d.method, date: d.start, status: "previsto", rec: r.id, createdAt: stamp() };
    S().payments.push(p);
    foco.save("payments", p);
  }
  ensureRecurringTasks();
  foco.toast(`Mensalidade criada. Próxima fatura: ${rel(occDate(r, r.issued))}.`);
  done();
  return c;
}
export function endRecurring(id: string) {
  const r = S().recurring.find((x) => x.id === id);
  if (!r) return;
  foco.remove("tasks", S().tasks.filter((t) => t.rec === id && !t.done).map((t) => t.id));
  foco.remove("recurring", id);
  foco.toast("Mensalidade terminada. Já não vais receber tarefas para a faturar.");
  done();
}

/* ── despesas ───────────────────────────────────────── */
export function addExpense(d: { what: string; amount: number; cat: string; date: string; rep: "none" | "monthly" }) {
  const e: Expense = { id: uid(), what: d.what || "Despesa", amount: d.amount, cat: d.cat, date: d.date, rep: d.rep, createdAt: stamp() };
  S().expenses.push(e);
  foco.save("expenses", e);
  foco.toast(d.rep === "monthly" ? `Despesa fixa criada: ${d.amount} €/mês.` : "Despesa registada.");
  done();
}
export function updateExpense(e: Expense, patch: Partial<Expense>) {
  Object.assign(e, patch);
  foco.save("expenses", e);
  done();
}
export function deleteExpense(id: string) {
  foco.remove("expenses", id);
  foco.toast("Despesa apagada.");
  done();
}

/* ── objetivos do mês ───────────────────────────────── */
export function addGoal(g: Partial<Goal> & { month: string; cat: string; t: string }) {
  const goal: Goal = {
    id: uid(), kind: "check", done: false, order: Date.now(), createdAt: stamp(), ...g,
  } as Goal;
  S().goals.push(goal);
  foco.save("goals", goal);
  done();
  return goal;
}
export function updateGoal(g: Goal, patch: Partial<Goal>) {
  Object.assign(g, patch);
  foco.save("goals", g);
  done();
}
export function toggleGoal(g: Goal) {
  g.done = !g.done;
  g.doneAt = g.done ? stamp() : undefined;
  foco.save("goals", g);
  if (g.done) foco.toast("Objetivo riscado. Boa.");
  done();
}
export function bumpGoal(g: Goal, n: number) {
  g.count = Math.max(0, (g.count ?? 0) + n);
  if (g.target && g.count >= g.target && !g.done) {
    g.done = true;
    g.doneAt = stamp();
    foco.toast(`${g.t}: meta atingida 🎯`);
  }
  foco.save("goals", g);
  done();
}
export function deleteGoal(id: string) {
  foco.remove("goals", id);
  done();
}
/** Copia os objetivos de um mês para outro (sem os contadores). */
export function copyGoals(from: string, to: string) {
  const src = S().goals.filter((g) => g.month === from);
  if (!src.length) return foco.toast("Esse mês não tem objetivos para copiar.");
  const copies = src.map((g) => ({ ...g, id: uid(), month: to, done: false, doneAt: undefined, count: 0, createdAt: stamp() }));
  S().goals.push(...copies);
  foco.save("goals", copies);
  foco.toast(`${copies.length} objetivos copiados.`);
  done();
}

/* ── definições ─────────────────────────────────────── */
export function updateSettings(patch: Partial<typeof foco.s.settings>) {
  Object.assign(S().settings, patch);
  foco.save("settings", S().settings);
  done();
}
