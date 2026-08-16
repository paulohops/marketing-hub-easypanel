export const STORE_WEEKDAYS = [
  { key: "monday", label: "Segunda-feira", shortLabel: "Seg" },
  { key: "tuesday", label: "Terça-feira", shortLabel: "Ter" },
  { key: "wednesday", label: "Quarta-feira", shortLabel: "Qua" },
  { key: "thursday", label: "Quinta-feira", shortLabel: "Qui" },
  { key: "friday", label: "Sexta-feira", shortLabel: "Sex" },
  { key: "saturday", label: "Sábado", shortLabel: "Sáb" },
  { key: "sunday", label: "Domingo", shortLabel: "Dom" },
] as const;

export type StoreWeekday = (typeof STORE_WEEKDAYS)[number]["key"];
export type StoreDayHours = { enabled: boolean; open: string; close: string };
export type StoreHours = Record<StoreWeekday, StoreDayHours>;

export function createDefaultStoreHours(): StoreHours {
  return Object.fromEntries(STORE_WEEKDAYS.map(({ key }) => [key, { enabled: false, open: "08:00", close: "18:00" }])) as StoreHours;
}

export function parseStoreHours(value?: string | null): StoreHours {
  const defaults = createDefaultStoreHours();
  if (!value?.trim()) return defaults;
  try {
    const parsed = JSON.parse(value) as Partial<Record<StoreWeekday, Partial<StoreDayHours>>>;
    for (const { key } of STORE_WEEKDAYS) {
      const day = parsed?.[key];
      if (!day) continue;
      defaults[key] = {
        enabled: Boolean(day.enabled),
        open: typeof day.open === "string" ? day.open : "08:00",
        close: typeof day.close === "string" ? day.close : "18:00",
      };
    }
  } catch {
    // Mantém horários antigos em texto sem quebrar o formulário estruturado.
  }
  return defaults;
}

export function serializeStoreHours(hours: StoreHours) {
  const hasEnabledDay = STORE_WEEKDAYS.some(({ key }) => hours[key].enabled);
  return hasEnabledDay ? JSON.stringify(hours) : "";
}

export function formatStoreHours(value?: string | null) {
  if (!value?.trim()) return "Não informado";
  try {
    const hours = parseStoreHours(value);
    const enabled = STORE_WEEKDAYS.filter(({ key }) => hours[key].enabled).map(({ key, shortLabel }) => `${shortLabel} ${hours[key].open}–${hours[key].close}`);
    return enabled.length ? enabled.join(" · ") : value;
  } catch {
    return value;
  }
}
