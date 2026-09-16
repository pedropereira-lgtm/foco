"use client";
import { foco, useFoco } from "@/lib/store";
import { focusStep } from "@/lib/actions";
import { PHASES, allDone, phaseOf } from "@/lib/logic";
import { diff, short } from "@/lib/dates";
import type { Project } from "@/lib/types";
import { Icon } from "@/components/icons";
import { Hero } from "@/components/ui";

export default function Projetos() {
  const f = useFoco();
  return (
    <>
      <Hero title="Projetos" sub="Em cada projeto vês a fase e o próximo passo. A fase avança sozinha quando fechas os passos dela." />
      <div className="projects">
        {f.s.projects.map((p) => <ProjCard key={p.id} p={p} />)}
        <button className="glass new-tile" onClick={() => foco.open({ kind: "newProject" })}>
          <Icon name="plus" /><b>Novo projeto</b><span>Dás-lhe um nome e escolhes o tipo. Os passos aparecem sozinhos.</span>
        </button>
      </div>
    </>
  );
}

function ProjCard({ p }: { p: Project }) {
  const dn = p.steps.filter((s) => s.done).length;
  const next = p.steps.filter((s) => !s.done).sort((a, b) => a.ph - b.ph)[0];
  const ph = phaseOf(p);
  const fin = allDone(p);
  const phS = p.steps.filter((s) => s.ph === ph);
  const phD = phS.filter((s) => s.done).length;
  const dd = p.due ? diff(p.due) : null;
  return (
    <article className="glass proj">
      <div className="proj-h">
        <div><div className="eyebrow">{p.client}</div><h2>{p.name}</h2><p className="muted small">{p.kind}</p></div>
        {p.due == null ? <span className="chip">Sem data de entrega</span> : dd! < 0 ? <span className="chip dot late">Entrega atrasada {-dd!} dias</span> : <span className={`chip${dd! <= 10 ? " dot follow" : ""}`}>Entrega {short(p.due)} · faltam {dd} dias</span>}
      </div>
      <div>
        <div className="phase-line">{fin ? <><b>Tudo feito</b> · pronto para entregar</> : <><b>Fase {ph + 1} de {PHASES.length}</b> · {PHASES[ph]} · {phD} de {phS.length} passos desta fase</>}</div>
        <div className="steps">{PHASES.map((x, i) => <div key={x} className={`st${fin || i < ph ? " done" : i === ph ? " now" : ""}`}><i /><span>{x}</span></div>)}</div>
      </div>
      {next ? (
        <div className="next">
          <div><div className="eyebrow">Próximo passo</div><div className="next-t">{next.t}</div></div>
          <button className="btn primary sm" onClick={() => focusStep(p, next.id)}><Icon name="play" />Pôr em foco</button>
        </div>
      ) : <div className="next"><div className="next-t">Passos todos feitos. Está pronto para entregar.</div></div>}
      <div className="proj-f">
        <div className="bar-wrap"><div className="bar-l">{dn} de {p.steps.length} passos feitos</div><div className="pbar"><i style={{ width: `${p.steps.length ? (dn / p.steps.length) * 100 : 0}%` }} /></div></div>
        <button className="btn sm" onClick={() => foco.open({ kind: "project", id: p.id, tab: "passos" })}>Abrir</button>
      </div>
    </article>
  );
}
