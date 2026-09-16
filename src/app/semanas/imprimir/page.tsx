"use client";
import { useEffect, useState } from "react";
import type { WeekMetrics } from "@/lib/types";
import { WeekCard, weekTitle } from "@/components/week";

export default function Imprimir() {
  const [data, setData] = useState<{ m: WeekMetrics; prev: WeekMetrics | null } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const w = new URLSearchParams(location.search).get("w");
    fetch("/api/weeks?n=12", { cache: "no-store" })
      .then((r) => (r.status === 401 ? (location.href = "/login", null) : r.json()))
      .then((j) => {
        if (!j) return;
        const weeks: WeekMetrics[] = j.weeks ?? [];
        const i = Math.max(0, weeks.findIndex((x) => x.week === w));
        if (!weeks[i]) return setErr("Semana não encontrada.");
        setData({ m: weeks[i], prev: weeks[i + 1] ?? null });
        document.title = `Foco · Semana ${weekTitle(weeks[i])}`;
      })
      .catch(() => setErr("Não consegui abrir o relatório."));
  }, []);

  return (
    <div className="app" style={{ marginLeft: 0, maxWidth: 900, marginInline: "auto" }}>
      <div className="no-print" style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <button className="btn primary" onClick={() => window.print()}>Guardar como PDF</button>
        <a className="btn" href="/semanas">Voltar</a>
      </div>
      {err && <p className="err">{err}</p>}
      {!data ? <div className="loading">A preparar…</div> : (
        <>
          <header className="hero-title"><h1>Foco · Semana {weekTitle(data.m)}</h1><p>Resumo semanal · valores líquidos</p></header>
          <div style={{ marginTop: 20 }}><WeekCard m={data.m} prev={data.prev} /></div>
        </>
      )}
    </div>
  );
}
