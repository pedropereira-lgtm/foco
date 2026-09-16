"use client";
import { useEffect, useRef, useState } from "react";
import { MOs, WDs, cap, e2 } from "@/lib/dates";

export interface ChartDay {
  d: number;
  fut: boolean;
  a: number[];
}
interface Props {
  label: string;
  series: { name: string; cls: string }[];
  days: ChartDay[];
  today: number;
  year: number;
  month: number; // 0-11
  table: boolean;
}

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
function niceStep(max: number) {
  const raw = max / 3;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}
const roundTop = (x: number, y: number, w: number, h: number, r: number) => {
  r = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
};

export function DailyChart({ label, series, days, today, year, month, table }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [table]);
  const dayLabel = (d: number) => {
    const x = new Date(year, month, d);
    return `${cap(WDs[x.getDay()])}, ${d} ${MOs[month]}`;
  };

  if (table) {
    const rows = days.filter((x) => sum(x.a) > 0);
    return (
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Dia</th>{series.map((s) => <th key={s.name} className="num">{s.name}</th>)}{series.length > 1 && <th className="num">Total</th>}<th>Estado</th></tr></thead>
          <tbody>{rows.length ? rows.map((x) => (
            <tr key={x.d}><td>{dayLabel(x.d)}</td>{x.a.map((v, i) => <td key={i} className="num">{e2(v)}</td>)}{series.length > 1 && <td className="num"><b>{e2(sum(x.a))}</b></td>}<td>{x.fut ? "Previsto" : "Recebido"}</td></tr>
          )) : <tr><td colSpan={series.length + 3}>Ainda sem entradas este mês.</td></tr>}</tbody>
        </table>
      </div>
    );
  }

  if (!days.some((x) => sum(x.a) > 0)) return <p className="empty" style={{ margin: "18px 4px" }}>Ainda sem entradas este mês. O gráfico aparece com o primeiro pagamento.</p>;
  const H = 250, pl = 62, pr = 4, pt = 8, pb = 24;
  const iw = Math.max(0, W - pl - pr), ih = H - pt - pb;
  const mx = Math.max(...days.map((x) => sum(x.a)), 10);
  const step = niceStep(mx);
  const top = Math.ceil(mx / step) * step;
  const y = (v: number) => pt + ih - (v / top) * ih;
  const band = days.length ? iw / days.length : 0;
  const bw = Math.max(3, Math.min(24, band * 0.6));
  const narrow = band < 24;
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-6; v += step) ticks.push(v);
  const hx = hover != null ? days[hover] : null;

  return (
    <div className="chart" ref={ref} onMouseLeave={() => setHover(null)}>
      {W > 0 && (
        <svg width={W} height={H} role="img" aria-label={label}>
          {ticks.map((v) => (
            <g key={v}>
              <line className="grid-l" x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} />
              <text className="ax-t" x={pl - 10} y={y(v) + 4} textAnchor="end">{Math.round(v).toLocaleString("pt-PT")} €</text>
            </g>
          ))}
          {days.map((x, i) => {
            const cx = pl + band * i + band / 2;
            const bx = cx - bw / 2;
            let base = pt + ih;
            const segs = x.a.map((v, k) => ({ v, k })).filter((s) => s.v > 0);
            return (
              <g key={x.d}>
                <rect className="hit" x={pl + band * i} y={pt} width={band} height={ih} onMouseEnter={() => setHover(i)} />
                {segs.map((s, j) => {
                  const h = (s.v / top) * ih;
                  const bottom = j > 0 ? base - 2 : base;
                  const topY = base - h;
                  const hh = Math.max(1, bottom - topY);
                  base -= h;
                  const cls = `b-${series[s.k].cls}${x.fut ? " fut" : ""}`;
                  return j === segs.length - 1
                    ? <path key={j} className={cls} d={roundTop(bx, topY, bw, hh, 4)} pointerEvents="none" />
                    : <rect key={j} className={cls} x={bx} y={topY} width={bw} height={hh} pointerEvents="none" />;
                })}
                {(!narrow || x.d === 1 || x.d % 5 === 0 || x.d === today) && (
                  <text className={`ax-t${x.d === today ? " today" : ""}`} x={cx} y={H - 6} textAnchor="middle">{x.d === today && !narrow ? "hoje" : x.d}</text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {hx && (
        <div className="tip" style={{ left: Math.max(0, Math.min(W - 200, pl + band * hover! + band / 2 - 100)) }}>
          <b>{dayLabel(hx.d)} · {hx.fut ? "previsto" : "recebido"}</b>
          {series.map((s, k) => <div key={s.name} className="tip-r"><span><i className={`sw ${s.cls}`} />{s.name}</span><span>{e2(hx.a[k])}</span></div>)}
          {series.length > 1 && <div className="tip-r tot"><span>Total</span><span>{e2(sum(hx.a))}</span></div>}
        </div>
      )}
    </div>
  );
}
