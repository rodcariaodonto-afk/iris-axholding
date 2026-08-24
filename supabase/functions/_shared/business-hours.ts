// Utilitário de horário de atendimento por conta.
// As configurações vivem em nina_settings: business_hours_start/end (time),
// business_days (int[] onde 0=domingo ... 6=sábado) e timezone (IANA).

export interface BusinessHoursSettings {
  timezone?: string | null;
  business_hours_start?: string | null;
  business_hours_end?: string | null;
  business_days?: number[] | null;
}

const DEFAULT_TZ = "America/Sao_Paulo";

function toMinutes(time?: string | null): number | null {
  if (!time) return null;
  const [h, m] = String(time).split(":");
  const hours = Number(h);
  const mins = Number(m ?? 0);
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return null;
  return hours * 60 + mins;
}

/** Retorna { dow, minutes } no fuso da conta para um instante UTC. */
function localParts(now: Date, timezone: string): { dow: number; minutes: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dowMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const dow = dowMap[get("weekday")] ?? 0;
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  return { dow, minutes: hour * 60 + minute };
}

/** Configuração utilizável? Sem faixa/dias definidos, não bloqueamos nada. */
export function hasBusinessHours(settings: BusinessHoursSettings | null | undefined): boolean {
  if (!settings) return false;
  const start = toMinutes(settings.business_hours_start);
  const end = toMinutes(settings.business_hours_end);
  const days = settings.business_days;
  return start !== null && end !== null && Array.isArray(days) && days.length > 0;
}

export function isWithinBusinessHours(
  settings: BusinessHoursSettings | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!hasBusinessHours(settings)) return true;
  const tz = settings!.timezone || DEFAULT_TZ;
  const start = toMinutes(settings!.business_hours_start)!;
  const end = toMinutes(settings!.business_hours_end)!;
  const days = settings!.business_days!.map(Number);
  const { dow, minutes } = localParts(now, tz);

  if (!days.includes(dow)) return false;
  if (start <= end) return minutes >= start && minutes < end;
  // Janela que atravessa a meia-noite (ex.: 20:00 -> 02:00)
  return minutes >= start || minutes < end;
}

/**
 * Próximo instante (UTC) em que a conta volta a atender.
 * Busca em passos de 15 minutos por até 14 dias; devolve null se não houver janela.
 */
export function nextOpeningAt(
  settings: BusinessHoursSettings | null | undefined,
  now: Date = new Date(),
): Date | null {
  if (!hasBusinessHours(settings)) return null;
  const stepMs = 15 * 60 * 1000;
  const maxSteps = (14 * 24 * 60) / 15;
  let cursor = new Date(Math.ceil(now.getTime() / stepMs) * stepMs);
  for (let i = 0; i < maxSteps; i++) {
    if (isWithinBusinessHours(settings, cursor)) return cursor;
    cursor = new Date(cursor.getTime() + stepMs);
  }
  return null;
}
