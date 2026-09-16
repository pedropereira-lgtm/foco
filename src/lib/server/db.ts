import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { COLLECTIONS, DEFAULT_SETTINGS, emptyState, type Collection, type Settings, type State, type WeekSnapshot } from "@/lib/types";

/*
 * Guarda os dados no Supabase (produção). Se a service role key ainda não estiver
 * configurada, usa um ficheiro local .data/foco.json, só para desenvolvimento.
 */

type Row = { id: string };
const TABLE = (c: Collection | "weeks") => `foco_${c}`;

let client: SupabaseClient | null = null;
function sb() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!client) client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}
export const usingSupabase = () => !!sb();

/* ── ficheiro local (dev) ───────────────────────────── */
const FILE = path.join(process.cwd(), ".data", "foco.json");
type FileDb = Record<string, Record<string, unknown>>;
async function readFile(): Promise<FileDb> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch {
    return {};
  }
}
async function writeFile(db: FileDb) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(db, null, 2));
}

/* ── API ────────────────────────────────────────────── */
export async function loadState(): Promise<State> {
  const state = emptyState();
  const s = sb();
  if (s) {
    const results = await Promise.all(
      [...COLLECTIONS, "settings" as const].map(async (c) => {
        const { data, error } = await s.from(TABLE(c)).select("data");
        if (error) throw new Error(`Supabase (${TABLE(c)}): ${error.message}`);
        return [c, (data ?? []).map((r) => r.data)] as const;
      }),
    );
    for (const [c, rows] of results) {
      if (c === "settings") state.settings = { ...DEFAULT_SETTINGS, ...((rows[0] as Settings) ?? {}) };
      else (state as unknown as Record<string, unknown[]>)[c] = rows;
    }
    return state;
  }
  const db = await readFile();
  for (const c of COLLECTIONS) (state as unknown as Record<string, unknown[]>)[c] = Object.values(db[c] ?? {});
  state.settings = { ...DEFAULT_SETTINGS, ...((db.settings?.main as Settings) ?? {}) };
  return state;
}

export interface Ops {
  put?: Partial<Record<Collection, Row[]>>;
  del?: Partial<Record<Collection, string[]>>;
}

export async function applyOps(ops: Ops) {
  const s = sb();
  const now = new Date().toISOString();
  if (s) {
    for (const [c, rows] of Object.entries(ops.put ?? {})) {
      if (!rows?.length) continue;
      const { error } = await s.from(TABLE(c as Collection)).upsert(rows.map((r) => ({ id: r.id, data: r, updated_at: now })));
      if (error) throw new Error(`Supabase (${TABLE(c as Collection)}): ${error.message}`);
    }
    for (const [c, ids] of Object.entries(ops.del ?? {})) {
      if (!ids?.length) continue;
      const { error } = await s.from(TABLE(c as Collection)).delete().in("id", ids);
      if (error) throw new Error(`Supabase (${TABLE(c as Collection)}): ${error.message}`);
    }
    return;
  }
  const db = await readFile();
  for (const [c, rows] of Object.entries(ops.put ?? {})) {
    db[c] ??= {};
    for (const r of rows ?? []) db[c][r.id] = r;
  }
  for (const [c, ids] of Object.entries(ops.del ?? {})) for (const id of ids ?? []) delete db[c]?.[id];
  await writeFile(db);
}

export async function saveSettings(patch: Partial<Settings>) {
  const st = await loadState();
  const next = { ...st.settings, ...patch, id: "main" as const };
  await applyOps({ put: { settings: [next] } });
  return next;
}

export async function loadWeeks(): Promise<WeekSnapshot[]> {
  const s = sb();
  if (s) {
    const { data, error } = await s.from(TABLE("weeks")).select("data");
    if (error) throw new Error(`Supabase (foco_weeks): ${error.message}`);
    return (data ?? []).map((r) => r.data as WeekSnapshot);
  }
  const db = await readFile();
  return Object.values(db.weeks ?? {}) as WeekSnapshot[];
}

export async function saveWeek(w: WeekSnapshot) {
  const s = sb();
  if (s) {
    const { error } = await s.from(TABLE("weeks")).upsert({ id: w.id, data: w, updated_at: new Date().toISOString() });
    if (error) throw new Error(`Supabase (foco_weeks): ${error.message}`);
    return;
  }
  const db = await readFile();
  db.weeks ??= {};
  db.weeks[w.id] = w;
  await writeFile(db);
}
