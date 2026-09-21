"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { foco, useFoco } from "@/lib/store";
import { openToday } from "@/lib/logic";
import { MO, WD, cap, today, todayISO } from "@/lib/dates";
import { Icon } from "./icons";
import { Sheets } from "./sheets";

const NAV = [
  ["/", "Agora", "target"],
  ["/contactos", "Contactos", "people"],
  ["/pipeline", "Pipeline", "columns"],
  ["/projetos", "Projetos", "layers"],
  ["/calendario", "Calendário", "calendar"],
  ["/financas", "Finanças", "wallet"],
  ["/objetivos", "Objetivos", "flag"],
  ["/semanas", "Semanas", "chart"],
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const f = useFoco();
  const path = usePathname();

  useEffect(() => {
    foco.load();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const typing = !!el && (/INPUT|TEXTAREA|SELECT/.test(el.tagName) || el.isContentEditable);
      if (e.key === "Escape" && foco.sheet) return foco.close();
      if (!typing && !foco.sheet && (e.key === "n" || e.key === "N") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        foco.open({ kind: "capture" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const d = today();
  const count = (href: string) =>
    !f.ready ? 0 : href === "/" ? openToday(f.s).length : href === "/pipeline" ? f.s.tasks.filter((t) => t.lead && !t.rec && !t.done && t.date <= todayISO()).length : href === "/projetos" ? f.s.projects.length : 0;

  return (
    <>
      <div className="wall" aria-hidden="true"><i /><i /><i /><i /></div>
      <nav className="side glass" aria-label="Navegação">
        <div className="brand"><span className="mark" /><span className="brand-name">Foco</span></div>
        <button className="cap-btn" onClick={() => foco.open({ kind: "capture" })} title="Capturar · N" aria-label="Capturar (tecla N)">
          <Icon name="plus" /><span>Capturar</span><kbd>N</kbd>
        </button>
        <div className="tabs">
          {NAV.map(([href, name, icon]) => {
            const on = href === "/" ? path === "/" : path.startsWith(href);
            const c = count(href);
            return (
              <Link key={href} href={href} className={`tab${on ? " on" : ""}`} aria-current={on ? "page" : undefined} title={name}>
                <Icon name={icon} />
                <span className="tab-l">{name}</span>
                {c > 0 && <span className="count">{c}</span>}
              </Link>
            );
          })}
        </div>
        <div className="side-foot">
          <b>{cap(WD[d.getDay()])}, {d.getDate()} de {MO[d.getMonth()]}</b>
          <SyncBadge />
          <span style={{ display: "flex", gap: 12, marginTop: 6 }}>
            <Link href="/definicoes" style={{ color: "inherit" }}>Definições</Link>
            <button className="linkbtn" style={{ padding: 0 }} onClick={async () => { await foco.flush(); await fetch("/api/login", { method: "DELETE" }); location.href = "/login"; }}>Sair</button>
          </span>
        </div>
      </nav>
      <div className="app">
        <div className="m-top">
          <div className="brand"><span className="mark" />Foco</div>
          <span style={{ display: "flex", gap: 8, alignItems: "center" }}><SyncBadge /><Link className="chip" href="/definicoes">Definições</Link></span>
        </div>
        {f.loadError ? (
          <section className="glass banner">
            <p><b>Não consegui abrir os teus dados.</b> {f.loadError}</p>
            <button className="btn sm primary" onClick={() => foco.load()}>Tentar outra vez</button>
          </section>
        ) : !f.ready ? (
          <div className="loading">A abrir o Foco…</div>
        ) : (
          <main>{children}</main>
        )}
      </div>
      {f.ready && <Sheets />}
      {f.toastMsg && (
        <div key={f.toastMsg.id} className="toast glass" role="status">
          <Icon name="check" />
          <span>{f.toastMsg.msg}</span>
        </div>
      )}
    </>
  );
}

function SyncBadge() {
  const f = useFoco();
  if (!f.ready) return null;
  const label = f.sync === "error" ? "Sem ligação, a tentar" : f.sync === "saving" ? "A guardar…" : f.storage === "local" ? "Guardado (modo local)" : "Tudo guardado";
  return (
    <span className={`sync ${f.sync}`} title={f.syncError ?? undefined}>
      <i />{label}
    </span>
  );
}
