"use client";
import { MOs, e0, e2, fmtMin, parse } from "@/lib/dates";
import type { WeekMetrics } from "@/lib/types";

export const weekTitle = (m: WeekMetrics) => {
  const f = parse(m.from);
  const t = parse(m.to);
  return `${f.getDate()}${f.getMonth() !== t.getMonth() ? ` ${MOs[f.getMonth()]}` : ""}–${t.getDate()} ${MOs[t.getMonth()]}`;
};

function Metric({ label, value, now, before, money }: { label: string; value: string; now?: number | null; before?: number | null; money?: boolean }) {
  const d = now != null && before != null ? now - before : null;
  return (
    <div className="metric">
      <small>{label}</small>
      <b>{value}</b>
      {d != null && d !== 0 && <span className={`delta ${d > 0 ? "up" : "down"}`}>{d > 0 ? "+" : ""}{money ? e0(d) : d}</span>}
    </div>
  );
}

export function WeekCard({ m, prev, current }: { m: WeekMetrics; prev?: WeekMetrics | null; current?: boolean }) {
  const p = prev ?? null;
  return (
    <section className="glass week-card">
      <div className="panel-h">
        <h3 style={{ fontSize: 20 }}>Semana {weekTitle(m)}{current && <span className="chip dot now" style={{ marginLeft: 10, verticalAlign: 3 }}>em curso</span>}</h3>
        <a className="btn sm no-print" href={`/semanas/imprimir?w=${m.week}`} target="_blank" rel="noopener">Relatório PDF</a>
      </div>
      <div className="eyebrow">Prospeção</div>
      <div className="metric-grid">
        <Metric label="Contactos novos" value={String(m.prospecting.newContacts)} now={m.prospecting.newContacts} before={p?.prospecting.newContacts} />
        <Metric label="Abordagens" value={String(m.prospecting.outreach)} now={m.prospecting.outreach} before={p?.prospecting.outreach} />
        <Metric label="Respostas" value={`${m.prospecting.replies} · ${m.prospecting.replyRate}%`} now={m.prospecting.replies} before={p?.prospecting.replies} />
        <Metric label="Propostas" value={String(m.prospecting.proposals)} now={m.prospecting.proposals} before={p?.prospecting.proposals} />
        <Metric label="Ganhos" value={String(m.prospecting.won)} now={m.prospecting.won} before={p?.prospecting.won} />
      </div>
      <div className="eyebrow">Tarefas</div>
      <div className="metric-grid">
        <Metric label="Feitas" value={String(m.tasks.done)} now={m.tasks.done} before={p?.tasks.done} />
        <Metric label="Adiadas" value={String(m.tasks.postponed)} />
        <Metric label="Em foco" value={fmtMin(m.tasks.focusMin)} />
        <Metric label="Follow-ups a tempo" value={`${m.tasks.followupsOnTime} de ${m.tasks.followupsOnTime + m.tasks.followupsLate}`} />
      </div>
      <div className="eyebrow">Finanças (líquido)</div>
      <div className="metric-grid">
        <Metric label="StudyHub" value={m.finance.platformNet == null ? "—" : e2(m.finance.platformNet)} now={m.finance.platformNet} before={p?.finance.platformNet} money />
        <Metric label="Subscritores" value={m.finance.newSubs == null ? "—" : `+${m.finance.newSubs} · −${m.finance.canceledSubs}`} />
        <Metric label="Serviços" value={e2(m.finance.servicesNet)} now={m.finance.servicesNet} before={p?.finance.servicesNet} money />
        <Metric label="Total" value={e2(m.finance.totalNet)} now={m.finance.totalNet} before={p?.finance.totalNet} money />
        <Metric label="Despesas" value={e2(m.finance.expenses ?? 0)} now={m.finance.expenses ?? 0} before={p?.finance.expenses} money />
        <Metric label="Lucro" value={e2(m.finance.profit ?? m.finance.totalNet)} now={m.finance.profit ?? null} before={p?.finance.profit} money />
        <Metric label="Por receber" value={e0(m.finance.toReceive)} />
      </div>
      <div className="eyebrow">Projetos e agenda</div>
      <div className="metric-grid">
        <Metric label="Passos feitos" value={String(m.projects.stepsDone)} />
        <Metric label="Reuniões" value={`${m.agenda.meetings} · ${String(m.agenda.hours).replace(".", ",")}h`} />
      </div>
      {m.projects.phasesClosed.length > 0 && <p className="muted small">Fases fechadas: {m.projects.phasesClosed.join(" · ")}</p>}
    </section>
  );
}
