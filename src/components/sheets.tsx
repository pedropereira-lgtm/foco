"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { foco, useFoco, type SheetState } from "@/lib/store";
import * as A from "@/lib/actions";
import { DURS, METHODS, ORIGINS, PHASES, REPS, STAGES, SVC, TPL, WEEK_ORDER, allDone, dealOf, eventsOn, initials, isRec, netOf, nextFollow, occDate, parseEvent, paysOf, phaseOf, repText, statusOf, wonOf } from "@/lib/logic";
import { D, MO, WD, WDs, cap, diff, e0, e2, endTime, parse, rel, short, todayISO } from "@/lib/dates";
import type { CalEvent, Contact, PayMethod, Payment, Project, Svc } from "@/lib/types";
import { Icon } from "./icons";
import { Check, Mini, Seg } from "./ui";
import { NotesBlock, TaskChips } from "./bits";

export function Sheets() {
  const f = useFoco();
  const sh = f.sheet;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sh) return;
    const el = ref.current?.querySelector<HTMLElement>("[data-autofocus]") ?? ref.current?.querySelector<HTMLElement>("input,textarea,button");
    el?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sh?.kind, (sh as { id?: string } | null)?.id]);
  if (!sh) return null;
  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) foco.close(); }}>
      <div className="sheet glass" role="dialog" aria-modal="true" ref={ref}>
        <SheetBody sh={sh} />
      </div>
    </div>
  );
}

function SheetBody({ sh }: { sh: SheetState }) {
  switch (sh.kind) {
    case "capture": return <CaptureSheet key={sh.type} initialType={sh.type} />;
    case "contact": return <ContactSheet key={sh.id} id={sh.id} tab={sh.tab} />;
    case "project": return <ProjectSheet key={sh.id} id={sh.id} tab={sh.tab} />;
    case "newProject": return <NewProjectSheet sh={sh} />;
    case "day": return <DaySheet date={sh.date} />;
    case "event": return <EventSheet key={sh.id ?? "new"} sh={sh} />;
    case "payment": return <PaymentSheet contact={sh.contact ?? null} back={!!sh.back} />;
    case "recurring": return <RecurringSheet contact={sh.contact ?? null} back={!!sh.back} />;
  }
}

/* ── Capturar ───────────────────────────────────────── */
const CAP_TYPES = [["mente", "Mente"], ["tarefa", "Tarefa"], ["evento", "Evento"], ["contacto", "Contacto"], ["projeto", "Projeto"]] as const;
type CapType = (typeof CAP_TYPES)[number][0];
const HINTS: Record<CapType, string> = {
  mente: "Fica na Mente, no ecrã Agora. Arrumas quando tiveres cabeça para isso.",
  tarefa: "Entra na lista de hoje. Se escreveres “amanhã”, fica para amanhã.",
  evento: "Escreve como falas: “treino seg qua sex 19h” ou “chamada Ricardo amanhã às 10h30”.",
  contacto: "Fica guardado em Contactos. Quando quiseres falar com a pessoa, carrega em “Quero contactar”.",
  projeto: "Abre a ficha do projeto, com os passos já prontos.",
};

function CaptureSheet({ initialType }: { initialType?: string }) {
  const [type, setType] = useState<CapType>((initialType as CapType) || "mente");
  const [v, setV] = useState("");
  const parsed = useMemo(() => (type === "evento" && v.trim() ? parseEvent(v) : null), [type, v]);

  const save = () => {
    const text = v.trim();
    if (!text) return;
    if (type === "evento") {
      const p = parseEvent(text);
      foco.open({ kind: "event", draft: { title: p.title || text, date: p.date, time: p.time, dur: p.dur, rep: p.rep, days: p.days } });
      return;
    }
    if (type === "projeto") return foco.open({ kind: "newProject", name: text });
    if (type === "contacto") {
      const c = A.createContact(text);
      foco.open({ kind: "contact", id: c.id, tab: "dados" });
      foco.toast("Contacto criado. Junta os dados que tiveres.");
      return;
    }
    if (type === "tarefa") {
      const tm = /amanh[ãa]/i.test(text);
      A.addTask(text, tm ? D(1) : todayISO());
      foco.toast(tm ? "Tarefa guardada para amanhã." : "Tarefa adicionada a hoje.");
    } else {
      A.addInbox(text);
      foco.toast("Guardado na Mente.");
    }
    foco.close();
  };

  return (
    <>
      <h3>O que tens na cabeça?</h3>
      <p className="muted">Escreve e carrega Enter. Não precisas de decidir já onde fica.</p>
      <form onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="sec"><input data-autofocus className="field lg" value={v} onChange={(e) => setV(e.target.value)} placeholder="ex: ligar à Marta amanhã" autoComplete="off" aria-label="O que tens na cabeça" /></div>
        <Seg options={CAP_TYPES} value={type} onChange={setType} label="Tipo" />
        <p className="hint">{HINTS[type]}</p>
        {parsed && (
          <p className="ev-sum"><Icon name={parsed.rep ? "repeat" : "calendar"} /><span>{parsed.title || "Evento"} · {parsed.rep ? repText({ rep: parsed.rep, days: parsed.days ?? [], date: parsed.date ?? todayISO() }) : cap(rel(parsed.date ?? todayISO()))} · {parsed.time ?? "falta a hora"}</span></p>
        )}
        <div className="actions">
          <button className="btn primary" type="submit">{type === "evento" || type === "projeto" ? "Continuar" : "Guardar"}</button>
          <button className="btn ghost" type="button" onClick={() => foco.close()}>Cancelar</button>
        </div>
      </form>
    </>
  );
}

/* ── Contacto ───────────────────────────────────────── */
const CFIELDS: [keyof Contact, string, string, string][] = [
  ["name", "Nome ou empresa", "ex: Clínica Sorriso", "text"], ["person", "Pessoa de contacto", "ex: Marta Silva", "text"],
  ["email", "Email", "nome@empresa.pt", "email"], ["phone", "Telefone", "912 345 678", "tel"],
  ["site", "Site", "empresa.pt", "text"], ["social", "Instagram ou LinkedIn", "@empresa", "text"],
  ["nif", "NIF", "123 456 789", "text"], ["address", "Morada", "Rua, código postal, cidade", "text"],
];

function ContactSheet({ id, tab }: { id: string; tab: "dados" | "notas" | "pagamentos" }) {
  const f = useFoco();
  const s = f.s;
  const c = s.contacts.find((x) => x.id === id);
  const [arm, setArm] = useState(false);
  if (!c) return <p className="empty">Este contacto já não existe.</p>;
  const st = statusOf(s, c);
  const d = dealOf(s, c.id);
  const won = wonOf(s, c.id);
  const pays = paysOf(s, c.id);
  const projs = s.projects.filter((p) => p.lead === c.id);
  const recs = s.recurring.filter((r) => r.contact === c.id);
  const nx = nextFollow(s, c.id);
  const recv = pays.filter((p) => p.status === "pago").reduce((a, p) => a + netOf(p.gross, p.method), 0);
  const due = pays.filter((p) => p.status !== "pago").reduce((a, p) => a + netOf(p.gross, p.method), 0);
  const setTab = (t: typeof tab) => foco.open({ kind: "contact", id, tab: t });
  const site = c.site ? (/^https?:/.test(c.site) ? c.site : "https://" + c.site) : "";

  return (
    <>
      <div className="c-head">
        <span className="avatar lg">{initials(c.name)}</span>
        <div><div className="eyebrow">{st === "cliente" ? "Cliente" : st === "pipeline" ? "Na pipeline" : "Contacto"}</div><h3>{c.name || "Novo contacto"}</h3></div>
      </div>
      <div className="kv">
        <div><small>Recebido</small><b>{recv ? e2(recv) : "—"}</b></div>
        <div><small>Por receber</small><b>{due ? e2(due) : "—"}</b></div>
        <div><small>Próximo follow-up</small><b>{nx ? cap(rel(nx.date)) : "Nenhum"}</b></div>
      </div>
      {d ? (
        <div className="pipe-box">
          <div className="panel-h"><span className="eyebrow">Na pipeline</span><button className="linkbtn" onClick={() => A.removeDeal(d.id)}>Tirar da pipeline</button></div>
          <Seg small options={STAGES.map((x) => [x.k, x.n] as const)} value={d.stage} onChange={(k) => A.moveDeal(d.id, k)} label="Fase" />
          <div className="ev-row">
            <Seg<Svc> small options={Object.entries(SVC) as [Svc, string][]} value={d.svc} onChange={(k) => A.updateDeal(d, { svc: k })} label="Serviço" />
            <label className="goal-in" htmlFor={`dv-${d.id}`}>Valor <input id={`dv-${d.id}`} className="field" type="number" min={0} step={50} defaultValue={d.val ?? ""} placeholder="0" onChange={(e) => A.updateDeal(d, { val: parseFloat(e.target.value) > 0 ? parseFloat(e.target.value) : null })} /> €</label>
          </div>
        </div>
      ) : (
        <div className="pipe-box row">
          <p className="muted small">{st === "cliente" ? `Cliente${won ? ` desde o negócio de ${SVC[won.svc]}` : ""}. Tens outro trabalho para propor?` : "Ainda não está na pipeline."}</p>
          <div className="ev-row">
            {st === "cliente" && !projs.length && <button className="btn sm" onClick={() => A.openProjectFromContact(c.id)}><Icon name="plus" />Criar projeto</button>}
            <button className="btn sm primary" onClick={() => A.toPipeline(c.id)}><Icon name="arrow" />{st === "cliente" ? "Novo negócio" : "Quero contactar"}</button>
          </div>
        </div>
      )}
      <Seg options={[["dados", "Dados"], ["notas", `Notas${c.notes?.length ? ` · ${c.notes.length}` : ""}`], ["pagamentos", `Pagamentos${pays.length ? ` · ${pays.length}` : ""}`]] as const} value={tab} onChange={setTab} label="Secção" />

      {tab === "dados" && (
        <>
          <div className="sec grid2">
            {CFIELDS.map(([k, l, ph, type]) => (
              <label key={k} className="lbl" htmlFor={`cf-${k}`}>{l}
                <input id={`cf-${k}`} className="field" type={type} defaultValue={String(c[k] ?? "")} placeholder={ph} autoComplete="off" data-autofocus={k === "name" && !c.name ? true : undefined} onChange={(e) => A.updateContact(c, { [k]: e.target.value } as Partial<Contact>)} />
              </label>
            ))}
          </div>
          <div className="sec"><div className="eyebrow">Como chegou até ti</div><Seg small options={ORIGINS.map((o) => [o, o] as const)} value={c.origin} onChange={(o) => A.updateContact(c, { origin: o })} /></div>
          <p className="hint">Fica guardado enquanto escreves.</p>
          <div className="actions">
            {c.email && <a className="btn sm" href={`mailto:${c.email}`}>Enviar email</a>}
            {c.phone && <a className="btn sm" href={`tel:${c.phone.replace(/\s/g, "")}`}>Ligar</a>}
            {site && <a className="btn sm" href={site} target="_blank" rel="noopener noreferrer">Abrir site</a>}
            {c.name.trim() && <button className="btn sm" onClick={() => A.followTomorrow(c.id)}><Icon name="clock" />Lembrar-me amanhã</button>}
            <button className="btn sm ghost danger" onClick={() => (arm ? A.deleteContact(c.id) : setArm(true))}>{arm ? "Carrega outra vez para apagar" : "Apagar contacto"}</button>
          </div>
        </>
      )}
      {tab === "notas" && <NotesBlock kind="contact" o={c} />}
      {tab === "pagamentos" && (
        <>
          <div className="sec">
            <div className="pay-h"><span className="eyebrow">Mensalidades</span><button className="btn sm" onClick={() => foco.open({ kind: "recurring", contact: c.id, back: true })}><Icon name="repeat" />Nova mensalidade</button></div>
            <div className="lst sec"><RecList recs={recs} /></div>
          </div>
          <div className="sec">
            <div className="pay-h"><span className="eyebrow">Sites e automações</span><button className="btn sm primary" onClick={() => foco.open({ kind: "payment", contact: c.id, back: true })}><Icon name="plus" />Registar pagamento</button></div>
            <div className="lst sec">{pays.length ? [...pays].sort((a, b) => (a.date > b.date ? -1 : 1)).map((p) => <PayRow key={p.id} p={p} />) : <p className="empty">Ainda sem pagamentos.</p>}</div>
          </div>
          {projs.length > 0 && (
            <div className="sec"><div className="eyebrow">Projetos</div>
              <div className="lst">{projs.map((p) => (
                <div key={p.id} className="lst-r"><div className="lst-t">{p.name}</div><div className="lst-s">{allDone(p) ? "Tudo feito" : `Fase: ${PHASES[phaseOf(p)]}`}</div><div className="lst-v"><button className="btn sm" onClick={() => foco.open({ kind: "project", id: p.id, tab: "passos" })}>Abrir</button></div></div>
              ))}</div>
            </div>
          )}
        </>
      )}
    </>
  );
}

export function PayRow({ p, withName }: { p: Payment; withName?: boolean }) {
  const s = foco.s;
  const n = netOf(p.gross, p.method);
  const late = p.status === "previsto" && p.date < todayISO();
  const name = s.contacts.find((c) => c.id === p.contact)?.name || p.client || "Sem cliente";
  return (
    <div className="lst-r">
      <div className="lst-t">{withName ? `${name} · ` : ""}{p.what}</div>
      <div className="lst-s">{cap(rel(p.date))} · {p.method}{p.method === "Stripe" ? ` · comissão −${e2(p.gross - n)}` : ""}</div>
      <div className="lst-v">
        {p.status === "pago" ? <span className="chip dot quick">Recebido</span> : late ? <span className="chip dot late">Em atraso</span> : <span className="chip">Previsto</span>}
        <span>{e2(n)}</span>
        {p.status !== "pago" && <button className="btn sm" onClick={() => A.markPaid(p.id)}><Icon name="check" />Recebi</button>}
      </div>
    </div>
  );
}

export function RecList({ recs, withName }: { recs: ReturnType<typeof foco.s.recurring.slice>; withName?: boolean }) {
  const s = foco.s;
  const [arm, setArm] = useState<string | null>(null);
  if (!recs.length) return <p className="empty">Sem mensalidades.</p>;
  return (
    <>
      {recs.map((r) => {
        const next = s.tasks.find((t) => t.rec === r.id && !t.done);
        return (
          <div key={r.id} className="lst-r">
            <div className="lst-t">{withName ? `${s.contacts.find((c) => c.id === r.contact)?.name ?? "—"} · ` : ""}{r.what}</div>
            <div className="lst-s">Todos os dias {r.day} · {r.method}{next ? <> · próxima fatura {diff(next.date) <= 0 ? <b>hoje</b> : rel(next.date)}</> : null}</div>
            <div className="lst-v"><span>{e0(r.amount)}/mês</span><button className="btn sm ghost danger" onClick={() => (arm === r.id ? A.endRecurring(r.id) : setArm(r.id))}>{arm === r.id ? "Confirmar" : "Terminar"}</button></div>
          </div>
        );
      })}
    </>
  );
}

/* ── Projeto ────────────────────────────────────────── */
function ProjectSheet({ id, tab }: { id: string; tab: "passos" | "notas" }) {
  const f = useFoco();
  const p = f.s.projects.find((x) => x.id === id);
  const [step, setStep] = useState("");
  const [arm, setArm] = useState(false);
  if (!p) return <p className="empty">Este projeto já não existe.</p>;
  const cur = phaseOf(p);
  const fin = allDone(p);
  const cl = p.lead ? f.s.contacts.find((c) => c.id === p.lead) : undefined;
  return (
    <>
      <div className="eyebrow">{p.client}</div>
      <h3>{p.name}</h3>
      <p className="muted small">{p.kind} · {p.due ? `entrega ${short(p.due)}` : "sem data de entrega"}</p>
      <div className="ev-row sec">
        <label className="goal-in" htmlFor={`pd-${p.id}`}>Entrega <input id={`pd-${p.id}`} className="field sm-field" type="date" defaultValue={p.due ?? ""} onChange={(e) => A.updateProject(p, { due: e.target.value || null })} /></label>
        {cl && <button className="btn sm" onClick={() => foco.open({ kind: "contact", id: cl.id, tab: "notas" })}><Icon name="people" />{cl.name}</button>}
      </div>
      <Seg options={[["passos", "Passos"], ["notas", `Notas${p.notes?.length ? ` · ${p.notes.length}` : ""}`]] as const} value={tab} onChange={(t) => foco.open({ kind: "project", id, tab: t })} />
      {tab === "notas" ? <NotesBlock kind="project" o={p} /> : (
        <>
          {PHASES.map((ph, i) => {
            const ss = p.steps.filter((x) => x.ph === i);
            const state = fin || i < cur ? "done" : i === cur ? "now" : "";
            return (
              <div key={ph} className="ph-group">
                <div className="ph-h"><span className="eyebrow">{ph}</span>{state === "now" ? <span className="chip dot now">Fase atual</span> : state === "done" ? <span className="chip dot quick">Fechada</span> : null}</div>
                <div className="rows">
                  {ss.length ? ss.map((x) => (
                    <div key={x.id} className={`row${x.done ? " is-done" : ""}`}>
                      <Check on={x.done} onClick={() => A.toggleStep(p, x.id)} label={x.done ? "Desmarcar passo" : "Marcar passo"} />
                      <div className="row-main"><div className="row-t">{x.t}</div></div>
                      {!x.done && <Mini icon="up" title="Pôr em foco" onClick={() => { A.focusStep(p, x.id); foco.close(); }} />}
                    </div>
                  )) : <p className="empty">Sem passos</p>}
                </div>
              </div>
            );
          })}
          <form className="dump sec" onSubmit={(e) => { e.preventDefault(); if (step.trim()) { A.addStep(p, step.trim()); setStep(""); } }}>
            <input className="field" value={step} onChange={(e) => setStep(e.target.value)} placeholder={`Adicionar passo a ${PHASES[cur]}…`} autoComplete="off" aria-label="Novo passo" />
            <button className="mini" aria-label="Adicionar"><Icon name="plus" /></button>
          </form>
          <div className="actions"><button className="btn sm ghost danger" onClick={() => (arm ? A.deleteProject(p.id) : setArm(true))}>{arm ? "Carrega outra vez para apagar" : "Apagar projeto"}</button></div>
        </>
      )}
    </>
  );
}

const DUES = [["", "Sem data"], ["14", "2 semanas"], ["30", "1 mês"], ["60", "2 meses"]] as const;
function NewProjectSheet({ sh }: { sh: Extract<SheetState, { kind: "newProject" }> }) {
  const [name, setName] = useState(sh.name ?? "");
  const [client, setClient] = useState(sh.client ?? "");
  const [svc, setSvc] = useState<Svc>(sh.svc ?? "site");
  const [due, setDue] = useState<string>("30");
  const tpl = TPL[svc];
  const submit = () => {
    if (!name.trim()) return;
    const p = A.createProject({ name: name.trim(), client: client.trim(), svc, due: due ? D(+due) : null, lead: sh.lead ?? null });
    foco.open({ kind: "project", id: p.id, tab: "passos" });
  };
  return (
    <>
      <div className="eyebrow">Novo projeto</div>
      <h3>{sh.lead ? "Novo cliente. Bora começar." : "Que projeto é?"}</h3>
      <p className="muted">Só precisas do nome e do tipo. Os passos ficam logo prontos e podes mudá-los depois.</p>
      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div className="sec grid2">
          <label className="lbl" htmlFor="np-name">Nome do projeto<input data-autofocus id="np-name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Site Clínica Sorriso" autoComplete="off" /></label>
          <label className="lbl" htmlFor="np-client">Cliente<input id="np-client" className="field" value={client} onChange={(e) => setClient(e.target.value)} placeholder="ex: Marta · Clínica Sorriso" autoComplete="off" /></label>
        </div>
        <div className="sec"><div className="eyebrow">Tipo</div><Seg<Svc> options={Object.entries(SVC) as [Svc, string][]} value={svc} onChange={setSvc} /></div>
        <div className="sec"><div className="eyebrow">Entrega</div><Seg<string> options={DUES.map(([k, n]) => [k, k ? `${n} · ${short(D(+k))}` : n] as const)} value={due} onChange={setDue} /></div>
        <div className="sec tpl">
          <div className="eyebrow">Passos que vou criar ({tpl.length})</div>
          {PHASES.map((ph, i) => <div key={ph} className="tpl-row"><b>{ph}</b><span>{tpl.filter((x) => x[0] === i).map((x) => x[1]).join(" · ")}</span></div>)}
        </div>
        <div className="actions"><button className="btn primary" type="submit"><Icon name="plus" />Criar projeto</button><button className="btn ghost" type="button" onClick={() => foco.close()}>Cancelar</button></div>
      </form>
    </>
  );
}

/* ── Dia ────────────────────────────────────────────── */
function DaySheet({ date }: { date: string }) {
  const f = useFoco();
  const [v, setV] = useState("");
  const d = parse(date);
  const ev = eventsOn(f.s, date);
  const tk = f.s.tasks.filter((t) => t.date === date);
  const n = diff(date);
  return (
    <>
      <div className="eyebrow">{n === 0 ? "Hoje" : n === 1 ? "Amanhã" : n === -1 ? "Ontem" : cap(WD[d.getDay()])}</div>
      <h3>{d.getDate()} de {MO[d.getMonth()]}</h3>
      {ev.length > 0 && (
        <div className="sec evs">{ev.map((e) => (
          <button key={e.id} className={`ev ${e.cat}`} onClick={() => foco.open({ kind: "event", id: e.id, on: date })}>
            <time>{e.time}</time><div><div className="ev-t">{e.t}{isRec(e) && <span className="rep"><Icon name="repeat" /></span>}</div><small>{e.time}–{endTime(e.time, e.dur || 60)}</small></div>
          </button>
        ))}</div>
      )}
      <div className="rows">{tk.map((t) => (
        <div key={t.id} className={`row${t.done ? " is-done" : ""}`}>
          <Check on={t.done} onClick={() => (t.done ? A.uncompleteTask(t.id) : A.completeTask(t.id))} />
          <div className="row-main"><div className="row-t">{t.t}</div><div className="row-s"><TaskChips t={t} /></div></div>
          <span className="row-min">{t.min} min</span>
          <Mini icon="x" title="Apagar tarefa" onClick={() => A.deleteTask(t.id)} />
        </div>
      ))}</div>
      {!ev.length && !tk.length && <p className="empty sec">Dia livre.</p>}
      <form className="dump sec" onSubmit={(e) => { e.preventDefault(); if (v.trim()) { A.addTask(v.trim(), date); setV(""); } }}>
        <input className="field" value={v} onChange={(e) => setV(e.target.value)} placeholder="Adicionar tarefa neste dia…" autoComplete="off" aria-label="Nova tarefa" />
        <button className="mini" aria-label="Adicionar"><Icon name="plus" /></button>
      </form>
      <div className="actions">
        <button className="btn" onClick={() => foco.open({ kind: "event", date })}><Icon name="calendar" />Novo evento</button>
        <button className="btn ghost" onClick={() => foco.close()}>Fechar</button>
      </div>
    </>
  );
}

/* ── Evento ─────────────────────────────────────────── */
function EventSheet({ sh }: { sh: Extract<SheetState, { kind: "event" }> }) {
  const orig = sh.id ? foco.s.events.find((x) => x.id === sh.id) : undefined;
  const dr = (sh.draft ?? {}) as Partial<{ title: string; date: string; time: string; dur: number; rep: CalEvent["rep"]; days: number[] }>;
  const [title, setTitle] = useState(orig?.t ?? dr.title ?? "");
  const [date, setDate] = useState(orig?.date ?? dr.date ?? sh.date ?? todayISO());
  const [time, setTime] = useState(orig?.time ?? dr.time ?? "");
  const [dur, setDur] = useState(orig?.dur ?? dr.dur ?? 60);
  const [rep, setRep] = useState<CalEvent["rep"]>(orig?.rep ?? dr.rep ?? "none");
  const [days, setDays] = useState<number[]>(orig?.days ?? dr.days ?? []);
  const [cat, setCat] = useState<CalEvent["cat"]>(orig?.cat ?? "trabalho");
  const [err, setErr] = useState<string | null>(null);
  const rec = rep !== "none";
  const T = todayISO();
  const summary = `${title || "Evento"} · ${rec ? repText({ rep, days, date }) : cap(rel(date))} · ${time ? `${time}–${endTime(time, dur)}` : "falta a hora"}`;

  const save = () => {
    if (!title.trim()) return setErr("Dá um nome ao evento.");
    if (!time) return setErr("Falta a hora.");
    const r = rep === "days" && !days.length ? "none" : rep;
    A.saveEvent({ t: title.trim(), date, time, dur, rep: r, days: r === "days" ? days : [], cat }, orig?.id);
    foco.close();
  };

  return (
    <>
      <div className="eyebrow">{orig ? "Evento" : "Novo evento"}</div>
      <form onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="sec"><input data-autofocus className="field lg" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex: Treino" autoComplete="off" aria-label="Nome do evento" /></div>
        <div className="ev-fields">
          <div className="ev-f"><span className="eyebrow">{rec ? "A partir de" : "Dia"}</span>
            <div className="ev-row">
              <Seg<string> small options={[[T, "Hoje"], [D(1), "Amanhã"]]} value={date} onChange={setDate} />
              <input type="date" className="field sm-field" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Data" />
            </div>
          </div>
          <div className="ev-f"><span className="eyebrow">Hora e duração</span>
            <div className="ev-row">
              <input type="time" className="field sm-field" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Hora" />
              <Seg<number> small options={DURS} value={dur} onChange={setDur} />
            </div>
          </div>
          <div className="ev-f"><span className="eyebrow">Repetir</span>
            <Seg small options={REPS} value={rep} onChange={(r) => { setRep(r); if (r === "days" && !days.length) setDays([parse(date).getDay()]); }} />
            {rep === "days" && (
              <div className="seg sm" role="group" aria-label="Dias da semana">
                {WEEK_ORDER.map((d) => (
                  <button key={d} type="button" className={days.includes(d) ? "on" : ""} aria-pressed={days.includes(d)} onClick={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])}>{WDs[d]}</button>
                ))}
              </div>
            )}
          </div>
          <div className="ev-f"><span className="eyebrow">Tipo</span><Seg small options={[["trabalho", "Trabalho"], ["pessoal", "Pessoal"]] as const} value={cat} onChange={setCat} /></div>
          <p className={`ev-sum ${cat}`}><Icon name={rec ? "repeat" : "calendar"} /><span>{summary}</span></p>
        </div>
        {err && <p className="err sec">{err}</p>}
        <div className="actions">
          <button className="btn primary" type="submit">{orig ? "Guardar" : "Criar evento"}</button>
          {orig && (isRec(orig) && sh.on ? (
            <>
              <button type="button" className="btn" onClick={() => { A.skipEvent(orig.id, sh.on!); foco.close(); }}>Tirar só de {short(sh.on)}</button>
              <button type="button" className="btn ghost danger" onClick={() => { A.deleteEvent(orig.id); foco.close(); }}>Apagar todos</button>
            </>
          ) : <button type="button" className="btn ghost danger" onClick={() => { A.deleteEvent(orig.id); foco.close(); }}>Apagar</button>)}
          <button type="button" className="btn ghost" onClick={() => foco.close()}>Cancelar</button>
        </div>
      </form>
    </>
  );
}

/* ── Pagamento e mensalidade ────────────────────────── */
function ClientInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <>
      <input id={id} className="field" list={`${id}-list`} autoComplete="off" placeholder="ex: Diogo Costa" value={value} onChange={(e) => onChange(e.target.value)} />
      <datalist id={`${id}-list`}>{foco.s.contacts.filter((c) => c.name).map((c) => <option key={c.id} value={c.name} />)}</datalist>
    </>
  );
}

function PaymentSheet({ contact, back }: { contact: string | null; back: boolean }) {
  const [client, setClient] = useState(contact ? foco.s.contacts.find((c) => c.id === contact)?.name ?? "" : "");
  const [what, setWhat] = useState("");
  const [val, setVal] = useState("");
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState<PayMethod>("Transferência");
  const [status, setStatus] = useState<"pago" | "previsto">("pago");
  const [err, setErr] = useState<string | null>(null);
  const save = () => {
    const g = parseFloat(val);
    if (!client.trim()) return setErr("Escolhe o cliente.");
    if (!(g > 0)) return setErr("Falta o valor.");
    const c = A.addPayment({ client: client.trim(), what: what.trim(), gross: g, method, date, status });
    if (back) foco.open({ kind: "contact", id: c.id, tab: "pagamentos" });
    else foco.close();
  };
  return (
    <>
      <div className="eyebrow">Sites e automações</div>
      <h3>Registar pagamento</h3>
      <form onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="sec grid2">
          <label className="lbl" htmlFor="pay-client">Cliente<ClientInput id="pay-client" value={client} onChange={setClient} /></label>
          <label className="lbl" htmlFor="pay-what">Descrição<input data-autofocus={contact ? true : undefined} id="pay-what" className="field" value={what} onChange={(e) => setWhat(e.target.value)} placeholder="ex: 50% de adjudicação" autoComplete="off" /></label>
          <label className="lbl" htmlFor="pay-val">Valor (€)<input id="pay-val" className="field" type="number" min={0} step={0.01} value={val} onChange={(e) => setVal(e.target.value)} placeholder="400" /></label>
          <label className="lbl" htmlFor="pay-date">Data<input id="pay-date" className="field sm-field" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        </div>
        <div className="sec"><div className="eyebrow">Como pagou</div><Seg<PayMethod> small options={METHODS.map((m) => [m, m] as const)} value={method} onChange={setMethod} /></div>
        <div className="sec"><div className="eyebrow">Estado</div><Seg small options={[["pago", "Já recebi"], ["previsto", "Vai pagar"]] as const} value={status} onChange={setStatus} /></div>
        <p className="hint">Pela Stripe, a comissão é descontada sozinha (estimativa). Transferência, MB Way e dinheiro contam com o valor inteiro.</p>
        {err && <p className="err">{err}</p>}
        <div className="actions"><button className="btn primary" type="submit">Guardar</button><button className="btn ghost" type="button" onClick={() => foco.close()}>Cancelar</button></div>
      </form>
    </>
  );
}

function RecurringSheet({ contact, back }: { contact: string | null; back: boolean }) {
  const [client, setClient] = useState(contact ? foco.s.contacts.find((c) => c.id === contact)?.name ?? "" : "");
  const [what, setWhat] = useState("Manutenção do site");
  const [val, setVal] = useState("");
  const [start, setStart] = useState(todayISO());
  const [method, setMethod] = useState<PayMethod>("Transferência");
  const [issued, setIssued] = useState<"1" | "0">("1");
  const [err, setErr] = useState<string | null>(null);
  const amount = parseFloat(val) || 0;
  const day = start ? parse(start).getDate() : 0;
  const next = start ? (issued === "1" ? occDate({ start, day }, 1) : start) : null;
  const save = () => {
    if (!client.trim()) return setErr("Escolhe o cliente.");
    if (!(amount > 0)) return setErr("Falta o valor por mês.");
    if (!start) return setErr("Falta a data da primeira fatura.");
    const c = A.createRecurring({ client: client.trim(), what: what.trim(), amount, method, start, issued: issued === "1" });
    if (back) foco.open({ kind: "contact", id: c.id, tab: "pagamentos" });
    else foco.close();
  };
  return (
    <>
      <div className="eyebrow">Sites e automações</div>
      <h3>Nova mensalidade</h3>
      <p className="muted">Crias uma vez. Todos os meses, no mesmo dia, aparece-te a tarefa para emitires a fatura. Quando a marcas como feita, fica registado o pagamento por receber.</p>
      <form onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="sec grid2">
          <label className="lbl" htmlFor="rec-client">Cliente<ClientInput id="rec-client" value={client} onChange={setClient} /></label>
          <label className="lbl" htmlFor="rec-what">O que inclui<input id="rec-what" className="field" value={what} onChange={(e) => setWhat(e.target.value)} autoComplete="off" /></label>
          <label className="lbl" htmlFor="rec-val">Valor por mês (€)<input data-autofocus={contact ? true : undefined} id="rec-val" className="field" type="number" min={0} step={1} value={val} onChange={(e) => setVal(e.target.value)} placeholder="30" /></label>
          <label className="lbl" htmlFor="rec-start">Data da primeira fatura<input id="rec-start" className="field sm-field" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        </div>
        <div className="sec"><div className="eyebrow">Como paga</div><Seg<PayMethod> small options={METHODS.map((m) => [m, m] as const)} value={method} onChange={setMethod} /></div>
        <div className="sec"><div className="eyebrow">Essa primeira fatura</div><Seg small options={[["1", "Já a emiti"], ["0", "Ainda não"]] as const} value={issued} onChange={setIssued} /></div>
        {next && <p className="ev-sum"><Icon name="repeat" /><span>Todos os meses, no dia {day}, aparece-te a tarefa para emitir a fatura{amount ? ` de ${e0(amount)}` : ""}. Próxima: {rel(next)}.</span></p>}
        {err && <p className="err">{err}</p>}
        <div className="actions"><button className="btn primary" type="submit">Criar mensalidade</button><button className="btn ghost" type="button" onClick={() => foco.close()}>Cancelar</button></div>
      </form>
    </>
  );
}
