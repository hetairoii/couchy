import * as SQLite from 'expo-sqlite';
import { DEFAULT_PROFILE, type Dose, type Med, type Profile } from './types';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function db() {
  dbPromise ??= init();
  return dbPromise;
}

async function init() {
  const d = await SQLite.openDatabaseAsync('couchy.db');
  await d.execAsync(`
    CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS meds (
      id TEXT PRIMARY KEY, name TEXT, dosage TEXT, instructions TEXT, color TEXT, times TEXT, days TEXT);
    CREATE TABLE IF NOT EXISTS doses (
      id TEXT PRIMARY KEY, med_id TEXT, scheduled_at TEXT, reminded_at TEXT, opened_at TEXT, taken_at TEXT,
      status TEXT, snooze_count INTEGER DEFAULT 0, source TEXT DEFAULT 'button', dirty INTEGER DEFAULT 1);
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT, med_id TEXT, text TEXT, audio_path TEXT, used INTEGER DEFAULT 0);
  `);
  return d;
}

// ---- key/value -----------------------------------------------------------------

export async function getKV<T>(key: string, fallback: T): Promise<T> {
  const row = await (await db()).getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
  return row ? (JSON.parse(row.value) as T) : fallback;
}

export async function setKV(key: string, value: unknown) {
  await (await db()).runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', key, JSON.stringify(value));
}

export const getProfile = async (): Promise<Profile> => ({ ...DEFAULT_PROFILE, ...(await getKV('profile', {})) });
export const setProfile = (p: Profile) => setKV('profile', p);

// ---- meds ----------------------------------------------------------------------

type MedRow = { id: string; name: string; dosage: string; instructions: string; color: string; times: string; days: string };
const toMed = (r: MedRow): Med => ({ ...r, times: JSON.parse(r.times), days: JSON.parse(r.days) });

export async function listMeds(): Promise<Med[]> {
  return (await (await db()).getAllAsync<MedRow>('SELECT * FROM meds ORDER BY name')).map(toMed);
}

export async function saveMed(m: Med) {
  await (await db()).runAsync(
    'INSERT OR REPLACE INTO meds (id, name, dosage, instructions, color, times, days) VALUES (?,?,?,?,?,?,?)',
    m.id, m.name, m.dosage, m.instructions, m.color, JSON.stringify(m.times), JSON.stringify(m.days),
  );
}

export async function deleteMed(id: string) {
  await (await db()).runAsync('DELETE FROM meds WHERE id = ?', id);
}

// ---- doses ---------------------------------------------------------------------

type DoseRow = {
  id: string; med_id: string; scheduled_at: string; reminded_at: string | null; opened_at: string | null;
  taken_at: string | null; status: Dose['status']; snooze_count: number; source: Dose['source'];
};
const toDose = (r: DoseRow): Dose => ({
  id: r.id, medId: r.med_id, scheduledAt: r.scheduled_at, remindedAt: r.reminded_at, openedAt: r.opened_at,
  takenAt: r.taken_at, status: r.status, snoozeCount: r.snooze_count, source: r.source,
});

export async function getDose(id: string): Promise<Dose | null> {
  const r = await (await db()).getFirstAsync<DoseRow>('SELECT * FROM doses WHERE id = ?', id);
  return r ? toDose(r) : null;
}

/** Creates the dose if it does not exist yet (idempotent). */
export async function ensureDose(id: string, medId: string, scheduledAt: Date): Promise<Dose> {
  const d = await db();
  await d.runAsync(
    "INSERT OR IGNORE INTO doses (id, med_id, scheduled_at, status) VALUES (?, ?, ?, 'pending')",
    id, medId, scheduledAt.toISOString(),
  );
  return (await getDose(id))!;
}

export async function updateDose(id: string, patch: Partial<Omit<Dose, 'id' | 'medId' | 'scheduledAt'>>) {
  const cols: Record<string, string> = {
    remindedAt: 'reminded_at', openedAt: 'opened_at', takenAt: 'taken_at',
    status: 'status', snoozeCount: 'snooze_count', source: 'source',
  };
  const sets = Object.keys(patch).map((k) => `${cols[k]} = ?`);
  const values = Object.values(patch) as (string | number | null)[];
  await (await db()).runAsync(`UPDATE doses SET ${[...sets, 'dirty = 1'].join(', ')} WHERE id = ?`, ...values, id);
}

export async function dosesBetween(from: Date, to: Date): Promise<Dose[]> {
  const rows = await (await db()).getAllAsync<DoseRow>(
    'SELECT * FROM doses WHERE scheduled_at >= ? AND scheduled_at < ? ORDER BY scheduled_at',
    from.toISOString(), to.toISOString(),
  );
  return rows.map(toDose);
}

export async function dirtyDoses(): Promise<Dose[]> {
  return (await (await db()).getAllAsync<DoseRow>('SELECT * FROM doses WHERE dirty = 1')).map(toDose);
}

export async function markClean(ids: string[]) {
  const d = await db();
  for (const id of ids) await d.runAsync('UPDATE doses SET dirty = 0 WHERE id = ?', id);
}

// ---- cached companion messages -------------------------------------------------

export type CachedMessage = { id: number; medId: string; text: string; audioPath: string | null };

export async function nextMessage(medId: string): Promise<CachedMessage | null> {
  const d = await db();
  const r = await d.getFirstAsync<{ id: number; med_id: string; text: string; audio_path: string | null }>(
    'SELECT * FROM messages WHERE med_id = ? AND used = 0 ORDER BY id LIMIT 1', medId);
  if (!r) return null;
  await d.runAsync('UPDATE messages SET used = 1 WHERE id = ?', r.id);
  return { id: r.id, medId: r.med_id, text: r.text, audioPath: r.audio_path };
}

export async function unusedMessageCount(medId: string): Promise<number> {
  const r = await (await db()).getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM messages WHERE med_id = ? AND used = 0', medId);
  return r?.n ?? 0;
}

export async function addMessage(medId: string, text: string, audioPath: string | null) {
  await (await db()).runAsync('INSERT INTO messages (med_id, text, audio_path) VALUES (?,?,?)', medId, text, audioPath);
}
