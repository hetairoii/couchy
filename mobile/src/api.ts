import { getKV, setKV } from './db';
import type { Dose, Med, Profile } from './types';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8010'; // Android emulator -> host

type Creds = { deviceId: string; apiKey: string };

/** The server answered with an error status (as opposed to a network failure, which throws TypeError). */
export class ApiError extends Error {
  constructor(public status: number, public path: string) {
    super(`${path} -> ${status}`);
  }
}

async function call<T>(path: string, init: RequestInit = {}, creds?: Creds): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (creds) headers['X-API-Key'] = creds.apiKey;
  if (typeof init.body === 'string') headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) throw new ApiError(res.status, path);
  return res.json() as Promise<T>;
}

export async function credentials(): Promise<Creds> {
  const saved = await getKV<Creds | null>('creds', null);
  if (saved) return saved;
  const r = await call<{ device_id: string; api_key: string }>('/devices', { method: 'POST' });
  const creds = { deviceId: r.device_id, apiKey: r.api_key };
  await setKV('creds', creds);
  return creds;
}

export const absolute = (path: string) => (path.startsWith('http') ? path : `${API_URL}${path}`);

export async function pushProfile(p: Profile) {
  const c = await credentials();
  await call(`/devices/${c.deviceId}/profile`, {
    method: 'PUT',
    body: JSON.stringify({
      preferred_name: p.preferredName, family_names: p.familyNames, likes: p.likes, routine_notes: p.routineNotes,
      companion_id: p.companionId, grace_minutes: p.graceMinutes, inactivity_hours: p.inactivityHours,
      quiet_start: p.quietStart, quiet_end: p.quietEnd, tz_offset_minutes: -new Date().getTimezoneOffset(),
    }),
  }, c);
}

export async function pushSchedules(meds: Med[]) {
  const c = await credentials();
  await call(`/devices/${c.deviceId}/schedules`, {
    method: 'PUT',
    body: JSON.stringify(meds.map((m) => ({
      id: m.id, name: m.name, dosage: m.dosage, instructions: m.instructions, times: m.times, days_of_week: m.days,
    }))),
  }, c);
}

export async function pushEvents(doses: Dose[]) {
  const c = await credentials();
  await call(`/devices/${c.deviceId}/events`, {
    method: 'POST',
    body: JSON.stringify({
      last_activity: new Date().toISOString(),
      doses: doses.map((d) => ({
        id: d.id, medication_id: d.medId, scheduled_at: d.scheduledAt, reminded_at: d.remindedAt,
        opened_at: d.openedAt, taken_at: d.takenAt, status: d.status, snooze_count: d.snoozeCount, source: d.source,
      })),
    }),
  }, c);
}

/** audio_url is null when the companion's voice could not be generated: show the text only. */
export type MessageOut = { text: string; audio_url: string | null };

export async function fetchMessages(medId: string, timeOfDay: string, count = 10): Promise<MessageOut[]> {
  const c = await credentials();
  return call(`/devices/${c.deviceId}/messages/batch`, {
    method: 'POST', body: JSON.stringify({ medication_id: medId, time_of_day: timeOfDay, count }),
  }, c);
}

export type PhraseKey = 'due' | 'well_done' | 'snooze_ok' | 'skip_ok' | 'help_listening' | 'help_sent';

export async function getPhrases() {
  const c = await credentials();
  return call<Record<PhraseKey, MessageOut>>(`/devices/${c.deviceId}/phrases`, {}, c);
}

export type VoiceReplyOut = {
  transcript: string; intent: string; reply: string; audio_url: string | null;
  dose_status: Dose['status']; taken_at: string | null;
};

export async function sendVoiceReply(dose: Dose, audioUri: string): Promise<VoiceReplyOut> {
  const c = await credentials();
  const form = new FormData();
  form.append('dose_event_id', dose.id);
  form.append('medication_id', dose.medId); // lets the server create the dose if it has not synced yet
  form.append('scheduled_at', dose.scheduledAt);
  form.append('audio', { uri: audioUri, name: 'reply.m4a', type: 'audio/mp4' } as unknown as Blob);
  return call(`/devices/${c.deviceId}/voice/reply`, { method: 'POST', body: form }, c);
}

export type HelpOut = { notified: number; linked: number };

/** Tells every linked relative (Telegram) that the person needs help. The audio note is optional. */
export async function sendHelp(audioUri: string | null): Promise<HelpOut> {
  const c = await credentials();
  const form = new FormData();
  if (audioUri) form.append('audio', { uri: audioUri, name: 'help.m4a', type: 'audio/mp4' } as unknown as Blob);
  return call(`/devices/${c.deviceId}/help`, { method: 'POST', body: form }, c);
}

export const getInsights = async (days = 7) => {
  const c = await credentials();
  return call<{
    metrics: Record<string, number | string | null>;
    daily: { day: string; total: number; taken: number }[];
    week_over_week: { this_week: number | null; previous_week: number | null; delta: number | null };
  }>(`/devices/${c.deviceId}/insights?days=${days}`, {}, c);
};

export type LinkCode = { code: string; deep_link: string };

/** The same code every time: all relatives use one link. */
export async function getLinkCode() {
  const c = await credentials();
  return call<LinkCode>(`/devices/${c.deviceId}/family/link-code`, {}, c);
}

/** Replaces the code (relatives already linked stay linked). Only on purpose. */
export async function rotateLinkCode() {
  const c = await credentials();
  return call<LinkCode>(`/devices/${c.deviceId}/family/link-code/rotate`, { method: 'POST' }, c);
}

export const getPreview = (companionId: string) =>
  call<{ audio_url: string }>(`/companions/${companionId}/preview`);
