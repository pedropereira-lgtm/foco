"use client";
import { useSyncExternalStore } from "react";
import { emptyState, type Collection, type State } from "./types";
import { missingRecTasks } from "./logic";

type Row = { id: string };
export type SheetState =
  | { kind: "capture"; type?: string; date?: string }
  | { kind: "contact"; id: string; tab: "dados" | "notas" | "pagamentos" }
  | { kind: "project"; id: string; tab: "passos" | "notas" }
  | { kind: "newProject"; name?: string; client?: string; svc?: "site" | "ia" | "pack"; lead?: string | null }
  | { kind: "day"; date: string }
  | { kind: "schedule"; id: string }
  | { kind: "event"; id?: string; on?: string; date?: string; draft?: Record<string, unknown> }
  | { kind: "payment"; contact?: string | null; back?: boolean }
  | { kind: "recurring"; contact?: string | null; back?: boolean };

export type SyncState = "ok" | "saving" | "error";

class Foco {
  s: State = emptyState();
  ready = false;
  loadError: string | null = null;
  storage: "supabase" | "local" | "" = "";
  sync: SyncState = "ok";
  syncError: string | null = null;
  sheet: SheetState | null = null;
  toastMsg: { id: number; msg: string } | null = null;
  version = 0;

  private listeners = new Set<() => void>();
  private put = new Map<string, Map<string, Row>>();
  private del = new Map<string, Set<string>>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getVersion = () => this.version;
  emit() {
    this.version++;
    this.listeners.forEach((l) => l());
  }

  async load() {
    try {
      const r = await fetch("/api/state", { cache: "no-store" });
      if (r.status === 401) {
        location.href = "/login";
        return;
      }
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Não consegui carregar os dados.");
      this.s = j.state;
      this.storage = j.storage;
      this.ready = true;
      this.loadError = null;
      // mensalidades: garante que a próxima tarefa de faturação existe
      for (const t of missingRecTasks(this.s)) {
        this.s.tasks.push(t);
        this.save("tasks", t);
      }
    } catch (e) {
      this.loadError = (e as Error).message;
    }
    this.emit();
  }

  /** Marca uma linha para gravar (o objeto já foi alterado em this.s). */
  save(col: Collection, row: Row | Row[]) {
    const rows = Array.isArray(row) ? row : [row];
    const m = this.put.get(col) ?? new Map();
    for (const r of rows) {
      m.set(r.id, r);
      this.del.get(col)?.delete(r.id);
    }
    this.put.set(col, m);
    this.schedule();
  }

  /** Remove da memória e da base de dados. */
  remove(col: Exclude<Collection, "settings">, ids: string | string[]) {
    const list = Array.isArray(ids) ? ids : [ids];
    const arr = this.s[col] as Row[];
    (this.s as unknown as Record<string, Row[]>)[col] = arr.filter((r) => !list.includes(r.id));
    const d = this.del.get(col) ?? new Set();
    for (const id of list) {
      d.add(id);
      this.put.get(col)?.delete(id);
    }
    this.del.set(col, d);
    this.schedule();
  }

  private schedule(delay = 450) {
    if (this.sync !== "error") this.sync = "saving";
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), delay);
  }

  async flush() {
    if (this.flushing) return this.schedule(300);
    const put: Record<string, Row[]> = {};
    const del: Record<string, string[]> = {};
    this.put.forEach((m, c) => m.size && (put[c] = [...m.values()]));
    this.del.forEach((s, c) => s.size && (del[c] = [...s]));
    if (!Object.keys(put).length && !Object.keys(del).length) {
      this.sync = "ok";
      this.emit();
      return;
    }
    this.put = new Map();
    this.del = new Map();
    this.flushing = true;
    try {
      const r = await fetch("/api/state", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ put, del }) });
      if (r.status === 401) {
        location.href = "/login";
        return;
      }
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Erro ${r.status}`);
      const wasError = this.sync === "error";
      this.sync = this.put.size || this.del.size ? "saving" : "ok";
      this.syncError = null;
      if (wasError) this.toast("Ligação recuperada. Está tudo guardado.");
    } catch (e) {
      // devolve à fila e tenta outra vez
      for (const [c, rows] of Object.entries(put)) {
        const m = this.put.get(c) ?? new Map();
        for (const row of rows) if (!m.has(row.id)) m.set(row.id, row);
        this.put.set(c, m);
      }
      for (const [c, ids] of Object.entries(del)) {
        const s = this.del.get(c) ?? new Set();
        ids.forEach((id) => s.add(id));
        this.del.set(c, s);
      }
      if (this.sync !== "error") this.toast("Não consegui guardar. Vou tentar outra vez sozinho.");
      this.sync = "error";
      this.syncError = (e as Error).message;
      this.flushing = false;
      this.emit();
      this.timer = setTimeout(() => this.flush(), 5000);
      return;
    }
    this.flushing = false;
    this.emit();
  }

  hasPending() {
    return this.put.size > 0 || this.del.size > 0 || this.flushing;
  }

  open(sheet: SheetState) {
    this.sheet = sheet;
    this.emit();
  }
  close() {
    const sh = this.sheet;
    this.sheet = null;
    // um contacto novo sem nome não fica guardado
    if (sh?.kind === "contact") {
      const c = this.s.contacts.find((x) => x.id === sh.id);
      if (c && !c.name.trim()) this.remove("contacts", c.id);
    }
    this.emit();
  }

  toast(msg: string) {
    this.toastMsg = { id: Date.now(), msg };
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastMsg = null;
      this.emit();
    }, 3200);
    this.emit();
  }
}

export const foco = new Foco();

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", (e) => {
    if (foco.hasPending()) {
      foco.flush();
      e.preventDefault();
    }
  });
}

export function useFoco() {
  useSyncExternalStore(foco.subscribe, foco.getVersion, () => 0);
  return foco;
}
