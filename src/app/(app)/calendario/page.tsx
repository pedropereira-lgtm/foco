"use client";
import { useEffect, useState } from "react";
import { foco, useFoco } from "@/lib/store";
import { completeTask, uncompleteTask } from "@/lib/actions";
import { eventsOn, isRec, repText } from "@/lib/logic";
import { MO, MOs, WDs, addDays, cap, endTime, iso, monday, today, todayISO } from "@/lib/dates";
import { Icon } from "@/components/icons";
import { Check, Hero, Seg } from "@/components/ui";

type Mode = "semana" | "mes";

export default function Calendario() {
  const f = useFoco();
  const s = f.s;
  const T = todayISO();
  const [mode, setMode] = useState<Mode>("semana");
  const [anchor, setAnchor] = useState(today());

  useEffect(() => {
    try {
      const m = localStorage.getItem("foco-cal");
      if (m === "semana" || m === "mes") setMode(m);
    } catch {}
  }, []);
  const changeMode = (m: Mode) => {
    setMode(m);
    try { localStorage.setItem("foco-cal", m); } catch {}
  };
  const move = (n: number) => setAnchor(mode === "semana" ? addDays(anchor, 7 * n) : new Date(anchor.getFullYear(), anchor.getMonth() + n, 1));

  let title: string;
  let body: React.ReactNode;
  if (mode === "semana") {
    const mon = monday(anchor);
    const sun = addDays(mon, 6);
    title = mon.getMonth() === sun.getMonth() ? `${mon.getDate()} a ${sun.getDate()} de ${MO[sun.getMonth()]}` : `${mon.getDate()} ${MOs[mon.getMonth()]} a ${sun.getDate()} ${MOs[sun.getMonth()]}`;
    const days = [...Array(7)].map((_, i) => addDays(mon, i));
    body = (
      <div className="week">
        {days.map((d) => {
          const k = iso(d);
          const ev = eventsOn(s, k);
          const tk = s.tasks.filter((t) => t.date === k);
          return (
            <section key={k} className={`glass day-col${k === T ? " today" : ""}${k < T ? " past" : ""}`}>
              <button className="day-h" onClick={() => foco.open({ kind: "day", date: k })}><span>{WDs[d.getDay()]}</span><b>{d.getDate()}</b></button>
              {ev.map((e) => (
                <button key={e.id} className={`wk-item ev-item ${e.cat}`} onClick={() => foco.open({ kind: "event", id: e.id, on: k })}>
                  <time>{e.time}–{endTime(e.time, e.dur || 60)}{isRec(e) && <span className="rep" title={`Repete ${repText(e)}`}><Icon name="repeat" /></span>}</time>{e.t}
                </button>
              ))}
              {tk.map((t) => (
                <div key={t.id} className={`wk-item task${t.done ? " done" : ""}`}>
                  <Check xs on={t.done} onClick={() => (t.done ? uncompleteTask(t.id) : completeTask(t.id))} />
                  <span>{t.t}</span>
                </div>
              ))}
              {!ev.length && !tk.length && <p className="empty">Livre</p>}
            </section>
          );
        })}
      </div>
    );
  } else {
    title = `${cap(MO[anchor.getMonth()])} ${anchor.getFullYear()}`;
    const y = anchor.getFullYear();
    const m = anchor.getMonth();
    const start = monday(new Date(y, m, 1));
    const end = addDays(monday(new Date(y, m + 1, 0)), 6);
    const days: Date[] = [];
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) days.push(d);
    body = (
      <div className="glass month">
        <div className="m-head">{["seg", "ter", "qua", "qui", "sex", "sáb", "dom"].map((d) => <span key={d}>{d}</span>)}</div>
        <div className="m-grid">
          {days.map((d) => {
            const k = iso(d);
            const ev = eventsOn(s, k);
            const tk = s.tasks.filter((t) => t.date === k);
            const items: { ev?: (typeof ev)[number]; tk?: (typeof tk)[number] }[] = [...ev.map((e) => ({ ev: e })), ...tk.map((t) => ({ tk: t }))];
            const show = items.slice(0, 3);
            return (
              <button key={k} className={`m-day${d.getMonth() !== m ? " out" : ""}${k === T ? " today" : ""}${k < T ? " past" : ""}`} onClick={() => foco.open({ kind: "day", date: k })} aria-label={`${d.getDate()} de ${MO[d.getMonth()]}, ${items.length} itens`}>
                <span className="m-n">{d.getDate()}</span>
                {show.map((it, i) =>
                  it.ev ? <span key={i} className={`m-it ev ${it.ev.cat}`} title={`${it.ev.time} ${it.ev.t}`}><b>{it.ev.time}</b> {it.ev.t}</span>
                    : <span key={i} className={`m-it${it.tk!.done ? " done" : ""}${!it.tk!.done && k < T ? " late" : ""}`} title={it.tk!.t}>{it.tk!.t}</span>,
                )}
                {items.length > 3 && <span className="m-more">+{items.length - 3}</span>}
                <span className="m-dots">{items.slice(0, 4).map((it, i) => <i key={i} className={it.ev ? `ev ${it.ev.cat}` : ""} />)}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <>
      <Hero title={title} sub={mode === "semana" ? "Tarefas e reuniões da semana. Carrega num dia para adicionar." : "O mês inteiro de uma vez. Carrega num dia para ver o detalhe."}>
        <Seg<Mode> options={[["semana", "Semana"], ["mes", "Mês"]]} value={mode} onChange={changeMode} label="Vista" />
        <button className="btn sm primary" onClick={() => foco.open({ kind: "event", date: T })}><Icon name="plus" />Evento</button>
        <div className="navs">
          <button className="mini" onClick={() => move(-1)} aria-label={mode === "semana" ? "Semana anterior" : "Mês anterior"}><Icon name="left" /></button>
          <button className="btn sm" onClick={() => setAnchor(today())}>Hoje</button>
          <button className="mini" onClick={() => move(1)} aria-label={mode === "semana" ? "Semana seguinte" : "Mês seguinte"}><Icon name="right" /></button>
        </div>
      </Hero>
      {body}
    </>
  );
}
