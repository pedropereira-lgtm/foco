export type ISODate = string; // YYYY-MM-DD
export type Svc = "site" | "ia" | "pack";
export type Stage = "ideia" | "contactado" | "conversa" | "proposta" | "ganho";
export type Rep = "none" | "daily" | "weekdays" | "days" | "weekly";
export type PayMethod = "Transferência" | "MB Way" | "Stripe" | "Dinheiro";

export interface Note {
  id: string;
  date: ISODate;
  via: string;
  t: string;
}

export interface Contact {
  id: string;
  name: string;
  person: string;
  email: string;
  phone: string;
  site: string;
  social: string;
  nif: string;
  address: string;
  origin: string;
  summary: string;
  notes: Note[];
  createdAt: string;
}

export interface Deal {
  id: string;
  contact: string;
  svc: Svc;
  val: number | null;
  stage: Stage;
  history: { stage: Stage; at: string }[];
  createdAt: string;
}

export interface Step {
  id: string;
  ph: number;
  t: string;
  done: boolean;
  doneAt?: string;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  kind: string;
  svc: Svc;
  lead: string | null;
  due: ISODate | null;
  summary: string;
  notes: Note[];
  steps: Step[];
  createdAt: string;
}

export interface Task {
  id: string;
  t: string;
  min: number;
  date: ISODate; // dia em que aparece para fazer
  due?: ISODate; // prazo (data limite), opcional
  done: boolean;
  doneAt?: string;
  proj?: string;
  step?: string;
  lead?: string;
  rec?: string;
  k?: number;
  chase?: string; // pagamento a cobrar
  focusLog?: { at: string; min: number }[];
  snoozedAt?: string[];
  late?: boolean; // foi feita depois do dia marcado
  order?: number;
  createdAt: string;
}

export interface CalEvent {
  id: string;
  t: string;
  date: ISODate;
  time: string;
  dur: number;
  rep: Rep;
  days: number[];
  cat: "trabalho" | "pessoal";
  skip: ISODate[];
  createdAt: string;
}

export interface Payment {
  id: string;
  contact: string | null;
  client?: string;
  what: string;
  gross: number;
  method: PayMethod;
  date: ISODate;
  status: "pago" | "previsto";
  paidAt?: string;
  rec?: string;
  fromTask?: string;
  chased?: boolean;
  createdAt: string;
}

export interface Recurring {
  id: string;
  contact: string;
  what: string;
  amount: number;
  method: PayMethod;
  start: ISODate;
  day: number;
  issued: number;
  createdAt: string;
}

export interface InboxItem {
  id: string;
  t: string;
  createdAt: string;
}

export interface Settings {
  id: "main";
  goal: number;
  tax: number;
  telegramChatId: number | null;
  lastDigest: ISODate | null;
  lastWeekly: ISODate | null;
}

export interface WeekSnapshot {
  id: string; // segunda-feira da semana, YYYY-MM-DD
  data: WeekMetrics;
}

export interface WeekMetrics {
  week: string;
  from: ISODate;
  to: ISODate;
  prospecting: { newContacts: number; outreach: number; replies: number; replyRate: number; proposals: number; won: number };
  tasks: { done: number; postponed: number; focusMin: number; followupsOnTime: number; followupsLate: number };
  finance: { platformNet: number | null; newSubs: number | null; canceledSubs: number | null; servicesNet: number; totalNet: number; toReceive: number };
  projects: { stepsDone: number; phasesClosed: string[] };
  agenda: { meetings: number; hours: number };
}

export interface State {
  contacts: Contact[];
  deals: Deal[];
  projects: Project[];
  tasks: Task[];
  events: CalEvent[];
  payments: Payment[];
  recurring: Recurring[];
  inbox: InboxItem[];
  settings: Settings;
}

export const COLLECTIONS = ["contacts", "deals", "projects", "tasks", "events", "payments", "recurring", "inbox"] as const;
export type Collection = (typeof COLLECTIONS)[number] | "settings";

export const DEFAULT_SETTINGS: Settings = {
  id: "main",
  goal: 0,
  tax: 25,
  telegramChatId: null,
  lastDigest: null,
  lastWeekly: null,
};

export const emptyState = (): State => ({
  contacts: [],
  deals: [],
  projects: [],
  tasks: [],
  events: [],
  payments: [],
  recurring: [],
  inbox: [],
  settings: { ...DEFAULT_SETTINGS },
});
