import type { ISODate } from "./types";

export const TZ = "Europe/Lisbon";

export const pad = (n: number) => String(n).padStart(2, "0");
export const iso = (d: Date): ISODate => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s: ISODate) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/** Data e hora "de parede" em Lisboa, independentemente do fuso do servidor. */
export function lisbonNow(at: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  return { date, hour, minute, dow: parse(date).getDay() };
}

export const todayISO = () => lisbonNow().date;
export const today = () => parse(todayISO());
export const D = (n: number) => iso(addDays(today(), n));
export const nowMin = () => {
  const n = lisbonNow();
  return n.hour * 60 + n.minute;
};

export const WD = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
export const WDs = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const MO = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const MOs = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export const diff = (s: ISODate) => Math.round((parse(s).getTime() - today().getTime()) / 864e5);
export const short = (s: ISODate) => {
  const d = parse(s);
  return `${d.getDate()} ${MOs[d.getMonth()]}`;
};
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export function rel(s: ISODate) {
  const n = diff(s);
  if (n === 0) return "hoje";
  if (n === 1) return "amanhã";
  if (n === -1) return "ontem";
  if (n < 0) return `há ${-n} dias`;
  if (n < 7) return `${WD[parse(s).getDay()]}, ${short(s)}`;
  return short(s);
}
export const monday = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));
export const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
export const endTime = (t: string, dur: number) => {
  const x = toMin(t) + dur;
  return `${pad(Math.floor(x / 60) % 24)}:${pad(x % 60)}`;
};
export const mmss = (s: number) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
export const fmtMin = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? pad(m % 60) : ""}`);
export const eur = (n: number) => `${n.toLocaleString("pt-PT")} €`;
export const e2 = (n: number) => `${n.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
export const e0 = (n: number) => `${Math.round(n).toLocaleString("pt-PT")} €`;
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const stamp = () => new Date().toISOString();
