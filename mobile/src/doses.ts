import type { Med } from './types';

export type DoseSlot = { id: string; medId: string; time: string; scheduledAt: Date };

const pad = (n: number) => String(n).padStart(2, '0');

/** Deterministic id so notifications, the home screen and sync all agree on the same dose. */
export function doseId(medId: string, day: Date, time: string): string {
  return `${medId}_${day.getFullYear()}${pad(day.getMonth() + 1)}${pad(day.getDate())}_${time.replace(':', '')}`;
}

/** Which doses are due on `day` (device-local calendar day), sorted by time. */
export function dosesForDay(meds: Med[], day: Date): DoseSlot[] {
  const slots: DoseSlot[] = [];
  for (const med of meds) {
    if (!med.days.includes(day.getDay())) continue;
    for (const time of med.times) {
      const [h, m] = time.split(':').map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) continue;
      const scheduledAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
      slots.push({ id: doseId(med.id, day, time), medId: med.id, time, scheduledAt });
    }
  }
  return slots.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
}

export function timeOfDay(date: Date): 'morning' | 'afternoon' | 'evening' {
  const h = date.getHours();
  return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
}

/** Accepts "8:00, 20:30" and returns normalized "08:00", "20:30"; invalid entries are dropped. */
export function parseTimes(input: string): string[] {
  return input
    .split(/[,\s]+/)
    .map((t) => t.match(/^(\d{1,2}):(\d{2})$/))
    .filter((m): m is RegExpMatchArray => !!m && +m[1] < 24 && +m[2] < 60)
    .map((m) => `${pad(+m[1])}:${m[2]}`);
}
