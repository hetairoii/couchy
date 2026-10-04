import { requireOptionalNativeModule } from 'expo';
import { cachedPhrases } from './audio';
import { peekMessage } from './db';
import type { Med } from './types';

/**
 * JS side of the native alarm (modules/couchy-alarm, Android only). The alarm rings like a phone alarm clock:
 * through the alarm audio stream (so it sounds even if the phone is muted or in Do Not Disturb), wakes the
 * screen, opens Couchy full screen over the lock screen and plays the companion's voice until the person answers.
 * In Expo Go, on iOS, or without the native module every function here is a harmless no-op.
 */

export type AlarmItem = { key: string; medId: string; medName: string; dosage: string; time: string; days: number[] };

export type AlarmStatus = {
  exactAlarm: boolean; // may schedule exact alarms
  fullScreen: boolean; // may open over the lock screen
  notifications: boolean; // notifications are allowed
  dndAccess: boolean; // may bypass Do Not Disturb
  batteryUnrestricted: boolean; // not killed by battery optimization
};

export type SettingsKind = 'exactAlarm' | 'fullScreen' | 'notifications' | 'dnd' | 'battery';

type Native = {
  schedule(items: AlarmItem[]): Promise<void>;
  scheduleOnce(item: AlarmItem, minutes: number): Promise<void>;
  cancelAll(): Promise<void>;
  setAudio(audioByMed: Record<string, string>, fallback: string | null): Promise<void>;
  stopRinging(): Promise<void>;
  getStatus(): Promise<AlarmStatus>;
  openSettings(kind: SettingsKind): Promise<void>;
};

const native = requireOptionalNativeModule<Native>('CouchyAlarm');

export const alarmAvailable = native !== null;

const toItems = (meds: Med[]): AlarmItem[] =>
  meds.flatMap((m) => m.times.map((time) => ({
    key: `${m.id}_${time}`, medId: m.id, medName: m.name, dosage: m.dosage, time, days: m.days,
  })));

export async function scheduleAlarms(meds: Med[]) {
  await native?.schedule(toItems(meds));
}

export async function scheduleSnoozeAlarm(med: Med, time: string, minutes: number) {
  const item = toItems([med]).find((i) => i.time === time);
  if (item) await native?.scheduleOnce(item, minutes);
}

export async function cancelAlarms() {
  await native?.cancelAll();
}

export async function stopAlarm() {
  await native?.stopRinging();
}

/**
 * Hands the alarm the audio it will play: for each medication the next cached message (the companion's voice
 * naming the medicine), plus the generic "it's time to take your medicine" line. No audio at all means the alarm
 * only vibrates and shows the text: never a system voice.
 */
export async function refreshAlarmAudio(meds: Med[]) {
  if (!native) return;
  const audio: Record<string, string> = {};
  for (const med of meds) {
    const msg = await peekMessage(med.id);
    if (msg?.audioPath) audio[med.id] = msg.audioPath;
  }
  await native.setAudio(audio, (await cachedPhrases()).due?.path ?? null);
}

export async function alarmStatus(): Promise<AlarmStatus | null> {
  return native ? native.getStatus() : null;
}

export async function openAlarmSettings(kind: SettingsKind) {
  await native?.openSettings(kind);
}
