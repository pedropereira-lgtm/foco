"use client";
import { useState } from "react";
import { foco } from "@/lib/store";
import { addNote, completeTask, deleteNote, promoteTask, setSummary, uncompleteTask } from "@/lib/actions";
import { VIAS } from "@/lib/logic";
import { cap, diff, e0, rel, todayISO } from "@/lib/dates";
import type { Note, Task } from "@/lib/types";
import { Icon } from "./icons";
import { Check, Mini, Seg } from "./ui";

export function TaskChips({ t }: { t: Task }) {
  const s = foco.s;
  const out: React.ReactNode[] = [];
  if (!t.done && t.date < todayISO()) out.push(<span key="late" className="chip dot late">{diff(t.date) === -1 ? "Ficou de ontem" : "Atrasada"}</span>);
  if (t.proj) {
    const p = s.projects.find((x) => x.id === t.proj);
    if (p) out.push(<button key="p" className="chip chip-btn" onClick={() => foco.open({ kind: "project", id: p.id, tab: "passos" })}>{p.name}</button>);
  }
  if (t.rec) {
    const r = s.recurring.find((x) => x.id === t.rec);
    if (r) out.push(<span key="r" className="chip dot now"><Icon name="repeat" />Mensalidade · {e0(r.amount)}</span>);
  }
  if (t.chase) out.push(<span key="c" className="chip dot late">Cobrança</span>);
  if (t.lead) {
    const c = s.contacts.find((x) => x.id === t.lead);
    if (c)
      out.push(
        <button key="l" className={`chip chip-btn dot${t.rec || t.chase ? "" : " follow"}`} onClick={() => foco.open({ kind: "contact", id: c.id, tab: t.rec || t.chase ? "pagamentos" : "notas" })}>
          {t.rec || t.chase ? "" : "Follow-up · "}{c.name}
        </button>,
      );
  }
  if (t.min <= 5) out.push(<span key="q" className="chip dot quick">Rápida</span>);
  return <>{out}</>;
}

export function TaskRow({ t, promote = true }: { t: Task; promote?: boolean }) {
  const [leaving, setLeaving] = useState(false);
  const toggle = () => {
    if (t.done) return uncompleteTask(t.id);
    setLeaving(true);
    setTimeout(() => completeTask(t.id), 280);
  };
  return (
    <div className={`row${t.done ? " is-done" : ""}${leaving ? " leaving" : ""}`}>
      <Check on={t.done} onClick={toggle} />
      <div className="row-main">
        <div className="row-t">{t.t}</div>
        <div className="row-s"><TaskChips t={t} /></div>
      </div>
      <span className="row-min">{t.min} min</span>
      {!t.done && promote && <Mini icon="up" title="Pôr em foco" onClick={() => { promoteTask(t.id); window.scrollTo({ top: 0, behavior: "smooth" }); }} />}
    </div>
  );
}

type Owner = { id: string; notes: Note[]; summary: string };
export function NotesBlock({ kind, o }: { kind: "contact" | "project"; o: Owner }) {
  const [text, setText] = useState("");
  const [via, setVia] = useState("");
  const ns = o.notes ?? [];
  const submit = () => {
    if (!text.trim()) return;
    addNote(kind, o, text.trim(), via);
    setText("");
    setVia("");
  };
  return (
    <>
      <div className="sec">
        <label className="eyebrow" htmlFor={`sum-${o.id}`}>Resumo</label>
        <textarea
          id={`sum-${o.id}`}
          className="field area"
          rows={3}
          defaultValue={o.summary}
          placeholder="O que quer, orçamento, prazos, o que é importante para esta pessoa…"
          onChange={(e) => setSummary(kind, o, e.target.value)}
        />
        <p className="hint">Fica guardado enquanto escreves.</p>
      </div>
      <div className="sec">
        <div className="eyebrow">Conversas e notas · {ns.length}</div>
        <form className="note-add" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <textarea
            className="field area"
            rows={3}
            value={text}
            placeholder="O que é que a pessoa disse? Escreve como te lembrares."
            aria-label="Nova nota"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } }}
          />
          <div className="note-bar">
            <Seg small options={VIAS.map((v) => [v, v] as const)} value={via} onChange={(v) => setVia(via === v ? "" : v)} label="Onde falaram" />
            <button className="btn primary sm" type="submit">Guardar nota</button>
          </div>
        </form>
        <div className="notes">
          {ns.length ? ns.map((n) => (
            <article key={n.id} className="note">
              <div className="note-d">
                <span>{cap(rel(n.date))}{n.via ? ` · ${n.via}` : ""}</span>
                <Mini className="xs" icon="x" title="Apagar nota" onClick={() => deleteNote(kind, o, n.id)} />
              </div>
              <p>{n.t}</p>
            </article>
          )) : <p className="empty">Ainda sem notas. Depois de cada conversa, escreve aqui o que ficou dito.</p>}
        </div>
      </div>
    </>
  );
}
