"use client";
import { useState } from "react";
import { foco, useFoco } from "@/lib/store";
import { addGoal, bumpGoal, copyGoals, toggleGoal } from "@/lib/actions";
import { AUTO_LABEL, GOAL_CATS, goalDone, goalValue, monthShift, thisMonth } from "@/lib/logic";
import { MO, e0 } from "@/lib/dates";
import type { Goal } from "@/lib/types";
import { Icon } from "@/components/icons";
import { Check, Hero, Mini } from "@/components/ui";

export default function Objetivos() {
  const f = useFoco();
  const [month, setMonth] = useState(thisMonth());
  const [adding, setAdding] = useState<string | null>(null);
  const [text, setText] = useState("");
  const goals = f.s.goals.filter((g) => g.month === month).sort((a, b) => a.order - b.order);
  const [y, m] = month.split("-").map(Number);
  const donos = goals.filter((g) => goalDone(f.s, g)).length;
  const pct = goals.length ? Math.round((donos / goals.length) * 100) : 0;
  const C = 2 * Math.PI * 32;
  const cats = [...new Set([...goals.map((g) => g.cat), ...(goals.length ? [] : GOAL_CATS)])];

  const submit = (cat: string) => {
    if (!text.trim()) return;
    addGoal({ month, cat, t: text.trim() });
    setText("");
  };

  return (
    <>
      <Hero title={`Objetivos · ${MO[m - 1]}`} sub={goals.length ? `${donos} de ${goals.length} feitos neste mês.` : "Escreve o que queres mesmo fazer este mês. Pouco e claro."}>
        <div className="navs">
          <button className="mini" onClick={() => setMonth(monthShift(month, -1))} aria-label="Mês anterior"><Icon name="left" /></button>
          <button className="btn sm" onClick={() => setMonth(thisMonth())}>Este mês</button>
          <button className="mini" onClick={() => setMonth(monthShift(month, 1))} aria-label="Mês seguinte"><Icon name="right" /></button>
        </div>
        <button className="btn sm" onClick={() => copyGoals(monthShift(month, -1), month)}>Copiar do mês anterior</button>
      </Hero>

      {goals.length > 0 && (
        <section className="glass panel" style={{ marginTop: 26 }}>
          <div className="day">
            <div className="ring sm">
              <svg viewBox="0 0 78 78"><circle cx="39" cy="39" r="32" className="trk" /><circle cx="39" cy="39" r="32" className="bar" strokeDasharray={C} strokeDashoffset={C * (1 - donos / goals.length)} /></svg>
              <div className="ring-t"><b>{pct}%</b></div>
            </div>
            <div>
              <h3>{y === new Date().getFullYear() && m - 1 === new Date().getMonth() ? "Este mês" : `${MO[m - 1]} de ${y}`}</h3>
              <p className="muted small">{donos} de {goals.length} objetivos concluídos</p>
            </div>
          </div>
        </section>
      )}

      <div className="settings-grid">
        {cats.map((cat) => {
          const list = goals.filter((g) => g.cat === cat);
          const ok = list.filter((g) => goalDone(f.s, g)).length;
          return (
            <section key={cat} className="glass panel">
              <div className="panel-h"><h3>{cat}</h3>{list.length > 0 && <span>{ok}/{list.length}</span>}</div>
              <div className="rows">
                {list.map((g) => <GoalRow key={g.id} g={g} />)}
                {!list.length && <p className="empty">Sem objetivos nesta área.</p>}
              </div>
              {adding === cat ? (
                <form className="dump" onSubmit={(e) => { e.preventDefault(); submit(cat); }}>
                  <input autoFocus className="field" value={text} onChange={(e) => setText(e.target.value)} placeholder="ex: Enviar 12 propostas" onBlur={() => { if (!text.trim()) setAdding(null); }} />
                  <button className="mini" aria-label="Adicionar"><Icon name="plus" /></button>
                </form>
              ) : (
                <button className="linkbtn" onClick={() => { setAdding(cat); setText(""); }}>+ Objetivo</button>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

function GoalRow({ g }: { g: Goal }) {
  const f = useFoco();
  const value = goalValue(f.s, g);
  const ok = goalDone(f.s, g);
  const target = g.target ?? 0;
  const unit = g.unit ?? "";
  return (
    <div className={`row${ok ? " is-done" : ""}`}>
      <Check on={ok} onClick={() => toggleGoal(g)} label={ok ? "Desmarcar" : "Marcar como feito"} />
      <div className="row-main">
        <div className="row-t">{g.t}</div>
        <div className="row-s">
          {g.kind === "count" && (
            <span className={`chip${target && value >= target ? " dot quick" : ""}`}>
              {unit === "€" ? `${e0(value)}${target ? ` de ${e0(target)}` : ""}` : `${value}${target ? ` de ${target}` : ""}${unit ? ` ${unit}` : ""}`}
            </span>
          )}
          {g.auto && <span className="chip dot now" title={AUTO_LABEL[g.auto]}><Icon name="repeat" />Conta-se sozinho</span>}
          {target > 0 && g.kind === "count" && (
            <span className="pbar" style={{ width: 90, display: "inline-block", verticalAlign: "middle" }}><i style={{ width: `${Math.min(100, (value / target) * 100)}%` }} /></span>
          )}
        </div>
      </div>
      {g.kind === "count" && !g.auto && (
        <>
          <Mini icon="x" title="Menos um" onClick={() => bumpGoal(g, -1)} />
          <Mini icon="plus" title="Mais um" onClick={() => bumpGoal(g, 1)} />
        </>
      )}
      <Mini icon="calendar" title="Editar objetivo" onClick={() => foco.open({ kind: "goal", id: g.id })} />
    </div>
  );
}
