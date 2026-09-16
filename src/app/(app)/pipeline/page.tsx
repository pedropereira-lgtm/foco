"use client";
import Link from "next/link";
import { useState } from "react";
import { foco, useFoco } from "@/lib/store";
import { moveDeal, openProjectFromContact } from "@/lib/actions";
import { CH, STAGES, SVC, nextFollow } from "@/lib/logic";
import { cap, diff, eur, rel } from "@/lib/dates";
import type { Deal } from "@/lib/types";
import { Icon } from "@/components/icons";
import { Hero } from "@/components/ui";

export default function Pipeline() {
  const f = useFoco();
  const s = f.s;
  const [over, setOver] = useState<string | null>(null);
  const play = s.deals.filter((d) => ["contactado", "conversa", "proposta"].includes(d.stage));
  const pot = play.reduce((a, d) => a + (d.val || 0), 0);

  return (
    <>
      <Hero title="Pipeline" sub={`${play.length} ${play.length === 1 ? "conversa" : "conversas"} em curso · ${eur(pot)} em potencial. Os contactos entram aqui quando carregas em “Quero contactar”.`} />
      <div className="board">
        {STAGES.map((st, i) => {
          const ds = s.deals.filter((d) => d.stage === st.k && s.contacts.some((c) => c.id === d.contact));
          const tot = ds.reduce((a, d) => a + (d.val || 0), 0);
          return (
            <section
              key={st.k}
              className={`glass col${over === st.k ? " over" : ""}`}
              aria-label={st.n}
              onDragOver={(e) => { e.preventDefault(); setOver(st.k); }}
              onDragLeave={() => setOver((o) => (o === st.k ? null : o))}
              onDrop={(e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData("text/plain"); if (id) moveDeal(id, st.k); }}
            >
              <div className="col-h"><div><b>{st.n}</b><span className="count">{ds.length}</span></div>{tot > 0 && <span className="col-sum">{eur(tot)}</span>}</div>
              {ds.length ? ds.map((d) => <DealCard key={d.id} d={d} i={i} />) : i === 0 ? <p className="empty">Vai a <Link href="/contactos">Contactos</Link> e carrega em “Quero contactar”.</p> : <p className="empty">Arrasta para aqui</p>}
            </section>
          );
        })}
      </div>
    </>
  );
}

function DealCard({ d, i }: { d: Deal; i: number }) {
  const s = foco.s;
  const c = s.contacts.find((x) => x.id === d.contact)!;
  const nx = nextFollow(s, c.id);
  const nxt = STAGES[i + 1];
  const nn = c.notes?.length ?? 0;
  let fu: React.ReactNode = null;
  if (nx) {
    const n = diff(nx.date);
    fu = n < 0 ? <span className="chip dot late">Follow-up atrasado</span> : n === 0 ? <span className="chip dot follow">Follow-up hoje</span> : <span className="chip"><Icon name="clock" />{cap(rel(nx.date))}</span>;
  }
  const open = () => foco.open({ kind: "contact", id: c.id, tab: "notas" });
  return (
    <article
      className="card"
      draggable
      tabIndex={0}
      role="button"
      aria-label={`Abrir ${c.name}`}
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", d.id); e.dataTransfer.effectAllowed = "move"; }}
      onClick={open}
      onKeyDown={(e) => { if (e.key === "Enter") open(); }}
    >
      <div className="card-top">
        <div><div className="card-n">{c.name}</div><div className="card-p">{c.person || c.social || c.origin}</div></div>
        <span className="ch">{CH[c.origin] ?? "—"}</span>
      </div>
      <div className="card-b">
        <span className={`chip dot svc-${d.svc}`}>{SVC[d.svc]}</span>
        {fu}
        {nn > 0 && <span className="chip" title={`${nn} ${nn === 1 ? "nota" : "notas"}`}><Icon name="note" />{nn}</span>}
      </div>
      <div className="card-f">
        <span className="val">{d.val ? eur(d.val) : "—"}</span>
        {nxt ? (
          <button className="mini" title={`Mover para ${nxt.n}`} aria-label={`Mover para ${nxt.n}`} onClick={(e) => { e.stopPropagation(); moveDeal(d.id, nxt.k); }}><Icon name="arrow" /></button>
        ) : s.projects.some((p) => p.lead === c.id) ? <span className="chip dot quick">Projeto ativo</span> : (
          <button className="btn sm" onClick={(e) => { e.stopPropagation(); openProjectFromContact(c.id); }}><Icon name="plus" />Criar projeto</button>
        )}
      </div>
    </article>
  );
}
