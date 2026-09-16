"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { foco, useFoco } from "@/lib/store";
import { updateSettings } from "@/lib/actions";
import { isLate, netOf, occDate } from "@/lib/logic";
import { MO, cap, e0, e2, rel, todayISO } from "@/lib/dates";
import type { PlatformMonth } from "@/lib/server/stripe";
import { Icon } from "@/components/icons";
import { Hero, Seg } from "@/components/ui";
import { DailyChart, type ChartDay } from "@/components/chart";
import { PayRow, RecList } from "@/components/sheets";

type Tab = "tudo" | "plataforma" | "servicos";
type Plat = PlatformMonth | { configured: false } | { configured: true; error: string } | null;

export default function Financas() {
  const f = useFoco();
  const s = f.s;
  const [tab, setTab] = useState<Tab>("tudo");
  const [table, setTable] = useState(false);
  const [plat, setPlat] = useState<Plat>(null);

  const load = useCallback(async (force = false) => {
    const r = await fetch(`/api/finance${force ? "?force" : ""}`, { cache: "no-store" }).catch(() => null);
    if (r?.ok) setPlat(await r.json());
  }, []);
  useEffect(() => {
    load();
    const id = setInterval(() => load(), 30_000);
    return () => clearInterval(id);
  }, [load]);

  // serviços (dados do Foco)
  const T = todayISO();
  const now = new Date(Number(T.slice(0, 4)), Number(T.slice(5, 7)) - 1, Number(T.slice(8)));
  const ym = T.slice(0, 7);
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const today = now.getDate();
  const svcRecv = Array(days + 1).fill(0);
  const svcExp = Array(days + 1).fill(0);
  let svcGross = 0, svcFees = 0;
  for (const p of s.payments) {
    const n = netOf(p.gross, p.method);
    if (p.status === "pago") {
      const d = p.paidAt ? p.paidAt.slice(0, 10) : p.date;
      if (d.slice(0, 7) !== ym) continue;
      svcRecv[Number(d.slice(8))] += n;
      svcGross += p.gross;
      svcFees += p.gross - n;
    } else if (!isLate(p) && p.date.slice(0, 7) === ym) svcExp[Number(p.date.slice(8))] += n;
  }
  for (const r of s.recurring) {
    const od = occDate(r, r.issued);
    if (od.slice(0, 7) === ym && od >= T) svcExp[Number(od.slice(8))] += netOf(r.amount, r.method);
  }
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const svc = { recv: sum(svcRecv), exp: sum(svcExp) };
  const late = s.payments.filter(isLate);
  const P = plat && "recv" in plat ? plat : null;

  const header = (
    <Hero title="Finanças" sub={<>{cap(MO[now.getMonth()])} {now.getFullYear()} · valores líquidos, já sem comissões.</>}>
      {P && <span className="chip live" title={`Atualizado ${new Date(P.updatedAt).toLocaleTimeString("pt-PT")}`}><i />Stripe · ao vivo</span>}
      <Seg<Tab> options={[["tudo", "Tudo"], ["plataforma", "StudyHub"], ["servicos", "Serviços"]]} value={tab} onChange={(t) => { setTab(t); window.scrollTo({ top: 0 }); }} />
    </Hero>
  );

  const stripeNotice = !plat ? null : !plat.configured ? (
    <section className="glass banner"><p><b>A Stripe ainda não está ligada.</b> Os números do StudyHub aparecem quando puseres a chave em Definições.</p><Link className="btn sm" href="/definicoes">Ver como</Link></section>
  ) : "error" in plat ? (
    <section className="glass banner"><p><b>A Stripe respondeu com um erro:</b> {plat.error}</p><button className="btn sm" onClick={() => load(true)}>Tentar outra vez</button></section>
  ) : null;

  return (
    <>
      {header}
      {tab === "tudo" && <Tudo P={P} svcRecv={svcRecv} svcExp={svcExp} svc={svc} svcGross={svcGross} svcFees={svcFees} days={days} today={today} now={now} table={table} setTable={setTable} setTab={setTab} notice={stripeNotice} lateCount={late.length} />}
      {tab === "plataforma" && <Plataforma P={P} days={days} today={today} now={now} table={table} setTable={setTable} notice={stripeNotice} />}
      {tab === "servicos" && <Servicos svc={svc} svcFees={svcFees} late={late.length ? late.reduce((a, p) => a + netOf(p.gross, p.method), 0) : 0} lateCount={late.length} />}
    </>
  );
}

function Tudo(props: {
  P: PlatformMonth | null; svcRecv: number[]; svcExp: number[]; svc: { recv: number; exp: number }; svcGross: number; svcFees: number;
  days: number; today: number; now: Date; table: boolean; setTable: (b: boolean) => void; setTab: (t: Tab) => void; notice: React.ReactNode; lateCount: number;
}) {
  const { P, svc, now, days, today } = props;
  const st = foco.s.settings;
  const recv = (P ? sumArr(P.recv) : 0) + svc.recv;
  const exp = (P ? sumArr(P.exp) : 0) + svc.exp;
  const gross = (P?.gross ?? 0) + props.svcGross;
  const fees = (P?.fees ?? 0) + props.svcFees;
  const reserve = (recv * st.tax) / 100;
  const close = recv + exp;
  const goal = st.goal;
  const pR = goal ? Math.min(100, (recv / goal) * 100) : 0;
  const pE = goal ? Math.min(100 - pR, (exp / goal) * 100) : 0;
  const left = Math.max(0, goal - close);
  const chartDays: ChartDay[] = Array.from({ length: days }, (_, i) => {
    const d = i + 1;
    return { d, fut: d > today, a: [(P?.recv[d] ?? 0) + (P?.exp[d] ?? 0), props.svcRecv[d] + props.svcExp[d]] };
  });
  return (
    <>
      {props.notice}
      <div className="fin-grid">
        <section className="glass panel span7">
          <div className="eyebrow">Recebido este mês · líquido</div>
          <div className="hero-num">{e2(recv)}</div>
          <p className="muted small">Bruto {e2(gross)} · comissões −{e2(fees)}</p>
          <div className="flow">
            <div className="flow-r"><span>Recebido líquido</span><b>{e2(recv)}</b></div>
            <div className="flow-r"><span>Guardar para impostos <Seg<number> small options={[0, 15, 25, 30].map((t) => [t, `${t}%`] as const)} value={st.tax} onChange={(t) => updateSettings({ tax: t })} /></span><b>−{e2(reserve)}</b></div>
            <div className="flow-r total"><span>Fica para ti</span><b>{e2(recv - reserve)}</b></div>
          </div>
        </section>
        <section className="glass panel span5">
          <div className="panel-h"><h3>Meta do mês</h3><label className="goal-in" htmlFor="fin-goal"><input id="fin-goal" className="field" type="number" min={0} step={100} defaultValue={goal || ""} placeholder="0" onBlur={(e) => updateSettings({ goal: Math.max(0, parseFloat(e.target.value) || 0) })} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />€ líquidos</label></div>
          <div className="big-line"><b>{e0(close)}</b><span>previstos até {days} de {MO[now.getMonth()]}</span></div>
          {goal > 0 ? (
            <>
              <div className="meter" role="img" aria-label={`Recebido ${e0(recv)} e previsto ${e0(exp)} de uma meta de ${e0(goal)}`}><i className="m-recv" style={{ width: `${pR}%` }} /><i className="m-exp" style={{ width: `${pE}%` }} /></div>
              <div className="legend"><span><i className="sw recv" />Já recebido {e0(recv)}</span><span><i className="sw exp" />Ainda vai entrar {e0(exp)}</span></div>
              <p className="goal-msg">{left > 0 ? <>Faltam <b>{e0(left)}</b> para a meta{P?.netPerSub ? <>. Dá cerca de <b>{Math.ceil(left / P.netPerSub)} subscritores</b> novos, ou um projeto.</> : "."}</> : <><b>Meta batida.</b> O mês deve fechar {e0(close - goal)} acima.</>}</p>
            </>
          ) : <p className="goal-msg">Escreve a tua meta mensal ali em cima para veres quanto falta.</p>}
        </section>
        <section className="glass panel">
          <div className="panel-h"><h3>Entradas por dia</h3><button className="linkbtn" onClick={() => props.setTable(!props.table)}>{props.table ? "Ver gráfico" : "Ver tabela"}</button></div>
          <div className="legend"><span><i className="sw plat" />StudyHub</span><span><i className="sw serv" />Serviços</span><span><i className="sw fut" />Mais claro = ainda vai entrar</span></div>
          <DailyChart label="Entradas líquidas por dia, StudyHub e serviços" series={[{ name: "StudyHub", cls: "plat" }, { name: "Serviços", cls: "serv" }]} days={chartDays} today={today} year={now.getFullYear()} month={now.getMonth()} table={props.table} />
        </section>
        <button className="glass panel src span6" onClick={() => props.setTab("plataforma")}>
          <div className="src-h"><b><i className="sw plat" />StudyHub</b><Icon name="right" /></div>
          <div className="src-v">{P ? e2(sumArr(P.recv)) : "—"}</div>
          <p className="muted small">{P ? `${P.active} subscritores · mais ${e0(sumArr(P.exp))} até ao fim do mês` : "Stripe por ligar"}</p>
        </button>
        <button className="glass panel src span6" onClick={() => props.setTab("servicos")}>
          <div className="src-h"><b><i className="sw serv" />Sites e automações</b><Icon name="right" /></div>
          <div className="src-v">{e2(svc.recv)}</div>
          <p className="muted small">Mais {e0(svc.exp)} a entrar este mês{props.lateCount ? ` · ${props.lateCount} em atraso` : ""}</p>
        </button>
      </div>
    </>
  );
}
const sumArr = (a: number[]) => a.reduce((x, y) => x + y, 0);

function Plataforma({ P, days, today, now, table, setTable, notice }: { P: PlatformMonth | null; days: number; today: number; now: Date; table: boolean; setTable: (b: boolean) => void; notice: React.ReactNode }) {
  const goal = foco.s.settings.goal;
  if (!P) return <>{notice ?? <div className="loading">A ler a Stripe…</div>}</>;
  const need = P.netPerSub && goal ? Math.ceil(goal / P.netPerSub) : null;
  return (
    <>
      <div className="tiles">
        <section className="glass tile"><div className="eyebrow">Recebido este mês</div><div className="tile-v">{e2(sumArr(P.recv))}</div><p className="muted small">{P.count} pagamentos · comissões −{e2(P.fees)}</p></section>
        <section className="glass tile"><div className="eyebrow">Hoje</div><div className="tile-v">{e2(P.todayNet)}</div><p className="muted small">{P.todayCount} {P.todayCount === 1 ? "pagamento" : "pagamentos"}</p></section>
        <section className="glass tile"><div className="eyebrow">Por mês, com os atuais</div><div className="tile-v">{e2(P.mrrNet)}</div><p className="muted small">Receita recorrente líquida (aprox.)</p></section>
        <section className="glass tile"><div className="eyebrow">Subscritores ativos</div><div className="tile-v">{P.active}</div><p className="muted small">+{P.newThisMonth} este mês · {P.canceling.length} vai cancelar</p></section>
      </div>
      <div className="fin-grid">
        <section className="glass panel">
          <div className="panel-h"><h3>Renovações por dia</h3><button className="linkbtn" onClick={() => setTable(!table)}>{table ? "Ver gráfico" : "Ver tabela"}</button></div>
          <p className="muted small">Cada subscritor renova num dia certo. As barras mais claras são o que ainda vai entrar este mês.</p>
          <DailyChart label="Entradas líquidas do StudyHub por dia" series={[{ name: "StudyHub", cls: "plat" }]} days={Array.from({ length: days }, (_, i) => ({ d: i + 1, fut: i + 1 > today, a: [P.recv[i + 1] + P.exp[i + 1]] }))} today={today} year={now.getFullYear()} month={now.getMonth()} table={table} />
        </section>
        <section className="glass panel span4">
          <div className="panel-h"><h3>Próximos 7 dias</h3><span>{e0(P.upcoming.reduce((a, u) => a + u.net, 0))}</span></div>
          <div className="lst">{P.upcoming.length ? P.upcoming.map((u) => (
            <div key={u.date} className="lst-r"><div className="lst-t">{cap(rel(u.date))}</div><div className="lst-s">{u.names.slice(0, 3).join(", ")}{u.names.length > 3 ? ` e mais ${u.names.length - 3}` : ""}</div><div className="lst-v">+{e2(u.net)}</div></div>
          )) : <p className="empty">Sem renovações nos próximos dias.</p>}</div>
        </section>
        <section className="glass panel span4">
          <div className="panel-h"><h3>Precisa de atenção</h3><span>{P.failed.length + P.canceling.length}</span></div>
          <div className="lst">
            {P.failed.map((x, i) => <div key={"f" + i} className="lst-r"><div className="lst-t">{x.name}</div><div className="lst-s">O pagamento falhou. A Stripe volta a tentar sozinha.</div><div className="lst-v"><span className="chip dot late">Falhou</span>{e2(x.amount)}</div></div>)}
            {P.canceling.map((x, i) => <div key={"c" + i} className="lst-r"><div className="lst-t">{x.name}</div><div className="lst-s">Cancelou. Sai {rel(x.date)}.</div><div className="lst-v"><span className="chip dot follow">Vai sair</span>−{e2(x.amount)}/mês</div></div>)}
            {!P.failed.length && !P.canceling.length && <p className="empty">Está tudo em ordem.</p>}
          </div>
        </section>
        <section className="glass panel span4">
          <div className="panel-h"><h3>O plano</h3></div>
          {P.netPerSub ? <p className="goal-msg" style={{ marginTop: 0 }}>Cada subscritor deixa-te <b>{e2(P.netPerSub)}</b> por mês depois da comissão.</p> : <p className="goal-msg" style={{ marginTop: 0 }}>Ainda sem subscrições ativas para calcular.</p>}
          {need ? (
            <>
              <p className="goal-msg">Para chegares aos <b>{e0(goal)}</b> por mês só com o StudyHub precisas de <b>{need} subscritores</b>.</p>
              <div className="meter" role="img" aria-label={`${P.active} de ${need} subscritores`}><i className="m-recv" style={{ width: `${Math.min(100, (P.active / need) * 100)}%` }} /></div>
              <div className="legend"><span><i className="sw recv" />{P.active} agora</span><span>{need > P.active ? `faltam ${need - P.active}` : "meta atingida"}</span></div>
            </>
          ) : <p className="hint">Define a meta mensal no separador Tudo.</p>}
        </section>
      </div>
    </>
  );
}

function Servicos({ svc, svcFees, late, lateCount }: { svc: { recv: number; exp: number }; svcFees: number; late: number; lateCount: number }) {
  const s = foco.s;
  const T = todayISO();
  const ym = T.slice(0, 7);
  const props = s.deals.filter((d) => ["conversa", "proposta"].includes(d.stage)).reduce((a, d) => a + (d.val || 0), 0);
  const open = s.payments.filter((p) => p.status !== "pago").sort((a, b) => (a.date < b.date ? -1 : 1));
  const paid = s.payments.filter((p) => p.status === "pago" && (p.paidAt?.slice(0, 7) ?? p.date.slice(0, 7)) === ym).sort((a, b) => (a.date > b.date ? -1 : 1));
  const recTotal = s.recurring.reduce((a, r) => a + r.amount, 0);
  return (
    <>
      <div className="tiles">
        <section className="glass tile"><div className="eyebrow">Recebido este mês</div><div className="tile-v">{e2(svc.recv)}</div><p className="muted small">Líquido · comissões −{e2(svcFees)}</p></section>
        <section className="glass tile"><div className="eyebrow">Ainda vai entrar este mês</div><div className="tile-v">{e2(svc.exp)}</div><p className="muted small">Pagamentos combinados e mensalidades</p></section>
        <section className="glass tile"><div className="eyebrow">Em atraso</div><div className="tile-v">{e2(late)}</div><p className="muted small">{lateCount} {lateCount === 1 ? "pagamento" : "pagamentos"} por cobrar</p></section>
        <section className="glass tile"><div className="eyebrow">Em propostas</div><div className="tile-v">{e0(props)}</div><p className="muted small">Se fechares as conversas em curso</p></section>
      </div>
      <div className="fin-grid">
        <section className="glass panel">
          <div className="pay-h"><h3 style={{ margin: 0, fontSize: 17 }}>Mensalidades · {e0(recTotal)}/mês</h3><button className="btn sm primary" onClick={() => foco.open({ kind: "recurring" })}><Icon name="repeat" />Nova mensalidade</button></div>
          <p className="muted small" style={{ marginTop: 6 }}>Todos os meses, no dia certo, aparece no Agora a tarefa para emitires a fatura.</p>
          <div className="lst sec"><RecList recs={s.recurring} withName /></div>
        </section>
        <section className="glass panel span6">
          <div className="pay-h"><h3 style={{ margin: 0, fontSize: 17 }}>Por receber</h3><button className="btn sm primary" onClick={() => foco.open({ kind: "payment" })}><Icon name="plus" />Registar pagamento</button></div>
          <div className="lst sec">{open.length ? open.map((p) => <PayRow key={p.id} p={p} withName />) : <p className="empty">Nada por receber.</p>}</div>
        </section>
        <section className="glass panel span6">
          <div className="panel-h"><h3>Recebidos este mês</h3><span>{paid.length}</span></div>
          <div className="lst">{paid.length ? paid.map((p) => <PayRow key={p.id} p={p} withName />) : <p className="empty">Ainda nada este mês.</p>}</div>
        </section>
      </div>
    </>
  );
}
