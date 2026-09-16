"use client";
import Link from "next/link";
import { useState } from "react";
import { foco, useFoco } from "@/lib/store";
import { createContact, toPipeline } from "@/lib/actions";
import { dealOf, initials, netOf, paysOf, stageName, statusOf } from "@/lib/logic";
import { e2 } from "@/lib/dates";
import { Icon } from "@/components/icons";
import { Empty, Hero, Seg } from "@/components/ui";

type Filter = "todos" | "cliente" | "pipeline" | "contacto";

export default function Contactos() {
  const f = useFoco();
  const s = f.s;
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const all = s.contacts.filter((c) => c.name.trim()).map((c) => ({ c, st: statusOf(s, c) }));
  const count = (k: Filter) => (k === "todos" ? all.length : all.filter((x) => x.st === k).length);
  const query = q.trim().toLowerCase();
  const list = all
    .filter((x) => filter === "todos" || x.st === filter)
    .filter((x) => !query || [x.c.name, x.c.person, x.c.email, x.c.phone, x.c.nif, x.c.social].join(" ").toLowerCase().includes(query))
    .sort((a, b) => a.c.name.localeCompare(b.c.name, "pt"));

  const add = () => {
    const c = createContact("");
    foco.open({ kind: "contact", id: c.id, tab: "dados" });
  };

  return (
    <>
      <Hero title="Contactos" sub="Todas as pessoas e empresas num só sítio. Quando quiseres falar com alguém, carrega em “Quero contactar” e ele passa para a Pipeline.">
        <button className="btn primary" onClick={add}><Icon name="plus" />Novo contacto</button>
      </Hero>
      {all.length === 0 ? (
        <div style={{ marginTop: 26 }}>
          <Empty icon="people" title="Ainda não tens contactos" text="Junta aqui clientes, pessoas que queres abordar e empresas que te interessam. Os dados ficam guardados para sempre.">
            <button className="btn primary" onClick={add}><Icon name="plus" />Criar o primeiro contacto</button>
          </Empty>
        </div>
      ) : (
        <>
          <div className="c-tools">
            <input className="field" type="search" id="c-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar por nome, email, telefone ou NIF…" autoComplete="off" aria-label="Procurar contactos" />
            <Seg<Filter>
              options={([["todos", "Todos"], ["cliente", "Clientes"], ["pipeline", "Na pipeline"], ["contacto", "Só contacto"]] as const).map(([k, n]) => [k, <>{n}<span className="count">{count(k)}</span></>] as const)}
              value={filter}
              onChange={setFilter}
              label="Filtrar"
            />
          </div>
          <section className="glass panel c-list">
            {list.length ? list.map(({ c, st }) => {
              const d = dealOf(s, c.id);
              const recv = paysOf(s, c.id).filter((p) => p.status === "pago").reduce((a, p) => a + netOf(p.gross, p.method), 0);
              return (
                <div key={c.id} className="c-row">
                  <button className="c-main" onClick={() => foco.open({ kind: "contact", id: c.id, tab: "dados" })}>
                    <span className="avatar">{initials(c.name)}</span>
                    <span className="c-name"><b>{c.name}</b><small>{[c.person, c.email || c.phone || c.social].filter(Boolean).join(" · ") || "Ainda sem dados"}</small></span>
                  </button>
                  <span className="c-st">
                    {st === "cliente" ? <span className="chip dot quick">Cliente</span> : st === "pipeline" && d ? <span className="chip dot now">{stageName(d.stage)}</span> : <span className="chip">Só contacto</span>}
                  </span>
                  <span className="c-money">{recv ? <><b>{e2(recv)}</b><small>recebido</small></> : <small>—</small>}</span>
                  <span className="c-act">
                    {d ? <Link className="btn sm" href="/pipeline">Ver na pipeline</Link> : (
                      <button className={`btn sm${st === "contacto" ? " primary" : ""}`} onClick={() => toPipeline(c.id)}><Icon name="arrow" />{st === "cliente" ? "Novo negócio" : "Quero contactar"}</button>
                    )}
                  </span>
                </div>
              );
            }) : <p className="empty">Nenhum contacto encontrado.</p>}
          </section>
        </>
      )}
    </>
  );
}
