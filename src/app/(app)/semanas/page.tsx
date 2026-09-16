"use client";
import { useEffect, useState } from "react";
import { useFoco } from "@/lib/store";
import type { WeekMetrics } from "@/lib/types";
import { Icon } from "@/components/icons";
import { Hero } from "@/components/ui";
import { WeekCard } from "@/components/week";

export default function Semanas() {
  useFoco();
  const [weeks, setWeeks] = useState<WeekMetrics[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/weeks?n=8", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setErr(j.error);
        else {
          setWeeks(j.weeks);
          if (j.stripeError) setErr(`Stripe: ${j.stripeError}`);
        }
      })
      .catch(() => setErr("Não consegui calcular as semanas."));
  }, []);

  return (
    <>
      <Hero title="Semanas" sub="O resumo de cada semana, contado sozinho. Compara com a anterior e exporta para analisar.">
        <a className="btn sm primary" href="/api/weeks?n=52&format=csv"><Icon name="download" />Excel (52 semanas)</a>
      </Hero>
      {err && <section className="glass banner"><p>{err}</p></section>}
      {!weeks ? <div className="loading">A contar…</div> : (
        <div style={{ display: "grid", gap: 18, marginTop: 26 }}>
          {weeks.map((w, i) => <WeekCard key={w.week} m={w} prev={weeks[i + 1]} current={i === 0} />)}
        </div>
      )}
    </>
  );
}
