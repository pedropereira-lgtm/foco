"use client";
import type { ReactNode } from "react";
import { Icon } from "./icons";

export function Seg<T extends string | number>({
  options,
  value,
  onChange,
  small,
  label,
}: {
  options: readonly (readonly [T, ReactNode])[];
  value: T | null | undefined;
  onChange: (v: T) => void;
  small?: boolean;
  label?: string;
}) {
  return (
    <div className={`seg${small ? " sm" : ""}`} role="group" aria-label={label}>
      {options.map(([k, n]) => (
        <button key={String(k)} type="button" className={value === k ? "on" : ""} aria-pressed={value === k} onClick={() => onChange(k)}>
          {n}
        </button>
      ))}
    </div>
  );
}

export function Hero({ title, sub, children }: { title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  if (!children)
    return (
      <header className="hero-title">
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </header>
    );
  return (
    <header className="cal-head">
      <div className="hero-title">
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      <div className="cal-ctrl no-print">{children}</div>
    </header>
  );
}

export function Empty({ icon, title, text, children }: { icon: string; title: string; text: string; children?: ReactNode }) {
  return (
    <section className="glass empty-state">
      <span className="avatar lg" style={{ color: "var(--tint)" }}>
        <Icon name={icon} size={22} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {children && <div className="actions" style={{ marginTop: 8, justifyContent: "center" }}>{children}</div>}
    </section>
  );
}

export function Check({ on, onClick, xs, label }: { on: boolean; onClick: () => void; xs?: boolean; label?: string }) {
  return (
    <button type="button" className={`check${xs ? " xs" : ""}${on ? " on" : ""}`} onClick={onClick} aria-label={label ?? (on ? "Desmarcar" : "Marcar como feita")}>
      <Icon name="check" />
    </button>
  );
}

export function Mini({ icon, title, onClick, className }: { icon: string; title: string; onClick: () => void; className?: string }) {
  return (
    <button type="button" className={`mini${className ? " " + className : ""}`} onClick={onClick} title={title} aria-label={title}>
      <Icon name={icon} />
    </button>
  );
}
