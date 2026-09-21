"use client";
import { useEffect, useRef, useState } from "react";
import { foco, useFoco } from "@/lib/store";
import { addFocusMinutes, addInbox, completeTask, inboxTo, snoozeTask } from "@/lib/actions";
import { eventsOn, isRec, openToday, repText } from "@/lib/logic";
import { D, cap, fmtMin, lisbonNow, mmss, nowMin, rel, toMin, todayISO } from "@/lib/dates";
import type { Task } from "@/lib/types";
import { Icon } from "@/components/icons";
import { Hero, Mini } from "@/components/ui";
import { TaskChips, TaskRow } from "@/components/bits";

export default function Agora() {
  const f = useFoco();
  const s = f.s;
  const T = todayISO();
  const open = openToday(s);
  const done = s.tasks.filter((t) => t.done && t.date === T);
  const [showDone, setShowDone] = useState(false);
  const [dump, setDump] = useState("");
  const focus = open[0];
  const rest = open.slice(1);
  const total = open.length + done.length;
  const mins = open.reduce((a, t) => a + t.min, 0);
  const nm = nowMin();
  const upcoming: ReturnType<typeof eventsOn> = [];
  for (let i = 0; i < 21 && upcoming.length < 4; i++)
    for (const e of eventsOn(s, D(i))) if (upcoming.length < 4 && !(i === 0 && toMin(e.time) + (e.dur || 60) <= nm)) upcoming.push(e);
  const nextToday = eventsOn(s, T).find((e) => toMin(e.time) > nm);
  const h = lisbonNow().hour;
  const C = 2 * Math.PI * 32;

  return (
    <>
      <Hero title={h < 12 ? "Bom dia." : h < 20 ? "Boa tarde." : "Boa noite."} sub="Uma coisa de cada vez. O resto espera aqui em baixo." />
      <div className="agora">
        <div className="stack">
          <FocusCard key={focus?.id ?? "none"} t={focus} />
          <section className="glass panel">
            <div className="panel-h"><h3>Depois disto</h3><span>{rest.length} {rest.length === 1 ? "tarefa" : "tarefas"}</span></div>
            <div className="rows">{rest.length ? rest.map((t) => <TaskRow key={t.id} t={t} />) : <p className="empty">Nada em fila. Carrega em Capturar (ou N) para acrescentar.</p>}</div>
            {done.length > 0 && (
              <>
                <button className="linkbtn" onClick={() => setShowDone(!showDone)}>{showDone ? "Esconder" : "Ver"} {done.length} {done.length === 1 ? "feita" : "feitas"} hoje</button>
                {showDone && <div className="rows">{done.map((t) => <TaskRow key={t.id} t={t} />)}</div>}
              </>
            )}
          </section>
        </div>
        <div className="stack">
          <section className="glass panel">
            <div className="day">
              <div className="ring sm">
                <svg viewBox="0 0 78 78"><circle cx="39" cy="39" r="32" className="trk" /><circle cx="39" cy="39" r="32" className="bar" strokeDasharray={C} strokeDashoffset={C * (1 - (total ? done.length / total : 0))} /></svg>
                <div className="ring-t"><b>{done.length}/{total}</b></div>
              </div>
              <div>
                <h3>{open.length ? "O teu dia" : "Dia fechado"}</h3>
                <p className="muted small">{open.length ? `Faltam cerca de ${fmtMin(mins)} de trabalho` : "Nada pendente para hoje"}</p>
                <p className="muted small">{nextToday ? `Livre até às ${nextToday.time} · ${nextToday.t}` : "Sem mais compromissos hoje"}</p>
              </div>
            </div>
          </section>
          <section className="glass panel">
            <div className="panel-h"><h3>Mente</h3><span>arrumas depois</span></div>
            <form className="dump" onSubmit={(e) => { e.preventDefault(); if (dump.trim()) { addInbox(dump.trim()); setDump(""); } }}>
              <input className="field" value={dump} onChange={(e) => setDump(e.target.value)} placeholder="Despeja aqui o que te vier à cabeça…" autoComplete="off" aria-label="Nova nota" />
              <button className="mini" aria-label="Guardar nota"><Icon name="plus" /></button>
            </form>
            <div className="ideas">
              {s.inbox.length ? s.inbox.map((i) => (
                <div key={i.id} className="idea">
                  <p>{i.t}</p>
                  <Mini icon="check" title="Passar a tarefa de hoje" onClick={() => inboxTo(i.id, "task")} />
                  <Mini icon="people" title="Passar a contacto" onClick={() => inboxTo(i.id, "contact")} />
                  <Mini icon="x" title="Apagar" onClick={() => inboxTo(i.id, "delete")} />
                </div>
              )) : <p className="empty">Cabeça limpa.</p>}
            </div>
          </section>
          <section className="glass panel">
            <div className="panel-h"><h3>Agenda</h3><button className="linkbtn" onClick={() => foco.open({ kind: "event", date: T })}>+ Evento</button></div>
            <div className="evs">
              {upcoming.length ? upcoming.map((e) => (
                <button key={e.id + e.on} className={`ev ${e.cat}`} onClick={() => foco.open({ kind: "event", id: e.id, on: e.on })}>
                  <time>{e.time}</time>
                  <div>
                    <div className="ev-t">{e.t}{isRec(e) && <span className="rep" title={`Repete ${repText(e)}`}><Icon name="repeat" /></span>}</div>
                    <small>{cap(rel(e.on))} · {fmtMin(e.dur || 60)}</small>
                  </div>
                </button>
              )) : <p className="empty">Nada marcado.</p>}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function FocusCard({ t }: { t?: Task }) {
  const [timer, setTimer] = useState<{ left: number; total: number; running: boolean } | null>(null);
  const started = useRef<number | null>(null);

  useEffect(() => {
    if (!timer?.running) return;
    const id = setInterval(() => {
      setTimer((x) => {
        if (!x) return x;
        const left = Math.max(0, x.left - 1);
        if (left === 0) {
          foco.toast("Acabou o tempo. Marca como feito ou dá-te mais uns minutos.");
          return { ...x, left, running: false };
        }
        return { ...x, left };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timer?.running]);

  const logFocus = () => {
    if (t && timer) addFocusMinutes(t.id, Math.round((timer.total - timer.left) / 60));
  };

  if (!t)
    return (
      <section className="glass focus enter">
        <div className="eyebrow">Hoje</div>
        <h2>Tudo feito. A sério.</h2>
        <p className="muted">Fecha o computador ou adianta algo da semana.</p>
      </section>
    );

  const s = foco.s;
  const lastNote = t.lead ? s.contacts.find((c) => c.id === t.lead)?.notes?.[0] : undefined;
  const nm = nowMin();
  const nx = eventsOn(s, todayISO()).find((e) => toMin(e.time) > nm);
  const gap = nx ? toMin(nx.time) - nm : 0;

  const head = (
    <>
      <div className="eyebrow">{timer ? (timer.running ? "Em foco" : "Em pausa") : "A seguir · só isto"}</div>
      <h2>{t.t}</h2>
      <div className="meta">
        <TaskChips t={t} />
        <span className="chip"><Icon name="clock" />{t.min} min</span>
        {nx && t.min > gap && <span className="chip dot follow">Só tens {fmtMin(gap)} até: {nx.t}</span>}
      </div>
      {lastNote && t.lead && (
        <button className="last-note" onClick={() => foco.open({ kind: "contact", id: t.lead!, tab: "notas" })}>
          <Icon name="note" /><span><b>Última nota, {rel(lastNote.date)}:</b> {lastNote.t.split("\n")[0]}</span>
        </button>
      )}
    </>
  );

  const finish = () => {
    logFocus();
    completeTask(t.id);
  };

  if (timer) {
    const C = 2 * Math.PI * 58;
    return (
      <section className="glass focus enter">
        <div className="focus-run">
          <div className="ring big">
            <svg viewBox="0 0 132 132"><circle cx="66" cy="66" r="58" className="trk" /><circle cx="66" cy="66" r="58" className="bar" strokeDasharray={C} strokeDashoffset={C * (1 - timer.left / timer.total)} /></svg>
            <div className="ring-t"><b>{mmss(timer.left)}</b><small>de {t.min} min</small></div>
          </div>
          <div>
            {head}
            <div className="actions">
              <button className="btn primary" onClick={finish}><Icon name="check" />Feito</button>
              <button className="btn" onClick={() => setTimer({ ...timer, running: !timer.running })}><Icon name={timer.running ? "pause" : "play"} />{timer.running ? "Pausa" : "Retomar"}</button>
              <button className="btn ghost" onClick={() => { logFocus(); setTimer(null); }}>Parar</button>
            </div>
          </div>
        </div>
      </section>
    );
  }
  return (
    <section className="glass focus enter">
      {head}
      <div className="actions">
        <button className="btn primary" onClick={() => { started.current = Date.now(); setTimer({ left: t.min * 60, total: t.min * 60, running: true }); }}><Icon name="play" />Começar foco</button>
        <button className="btn" onClick={() => completeTask(t.id)}><Icon name="check" />Feito</button>
        <button className="btn ghost" onClick={() => snoozeTask(t.id)}><Icon name="moon" />Fica para amanhã</button>
        <button className="btn ghost" onClick={() => foco.open({ kind: "schedule", id: t.id })}><Icon name="calendar" />Outro dia</button>
      </div>
    </section>
  );
}
