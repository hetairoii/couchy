import NetInfo from '@react-native-community/netinfo';
import { cacheAudio, type CachedPhrases } from './audio';
import {
  addMessage, clearMessages, dirtyDoses, getKV, getProfile, listMeds, markClean, setKV, unusedMessageCount,
} from './db';
import { fetchMessages, getPhrases, pushEvents, pushProfile, pushSchedules, sendHelp } from './api';
import { refreshAlarmAudio } from './alarm';
import { timeOfDay } from './doses';

let running = false;

export async function online() {
  const s = await NetInfo.fetch();
  return !!s.isConnected && s.isInternetReachable !== false;
}

/** Pushes pending dose events (and an activity ping). Safe to call often; never throws. */
export async function flushOutbox() {
  if (running || !(await online())) return;
  running = true;
  try {
    const doses = await dirtyDoses();
    await pushEvents(doses);
    await markClean(doses.map((d) => d.id));
  } catch {
    // stays dirty, retried on next flush
  } finally {
    running = false;
  }
}

// ---- help requests that could not be sent yet ------------------------------------

type QueuedHelp = { uri: string | null; at: string };

export async function queueHelp(uri: string | null) {
  const q = await getKV<QueuedHelp[]>('help_queue', []);
  await setKV('help_queue', [...q, { uri, at: new Date().toISOString() }]);
}

/** Retries help requests saved while offline. A request older than 30 minutes is dropped: it is stale. */
export async function flushHelpQueue() {
  const q = await getKV<QueuedHelp[]>('help_queue', []);
  if (!q.length || !(await online())) return;
  const left: QueuedHelp[] = [];
  for (const item of q) {
    if (Date.now() - new Date(item.at).getTime() > 30 * 60_000) continue;
    try { await sendHelp(item.uri); } catch { left.push(item); }
  }
  await setKV('help_queue', left);
}

// ---- configuration ---------------------------------------------------------------

/** Sends profile + schedules to the server (call after any change). */
export async function pushConfig() {
  if (!(await online())) return;
  try {
    await pushProfile(await getProfile());
    await pushSchedules(await listMeds());
  } catch {
    // retried on next app start
  }
}

/**
 * Downloads the fixed lines (well done, reminder in 10 min, help...) in the companion's voice.
 * When the companion or the person's name changes, every cached audio is dropped: it was in another voice.
 */
export async function syncPhrases() {
  if (!(await online())) return;
  const p = await getProfile();
  const signature = `${p.companionId}|${p.preferredName}`;
  const known = await getKV<string>('voice_signature', '');
  const phrases = await getKV<CachedPhrases>('phrases', {});
  const complete = Object.values(phrases).length > 0 && Object.values(phrases).every((x) => x?.path);
  if (known === signature && complete) return;

  if (known !== signature) {
    await clearMessages();
    await setKV('phrases', {});
  }
  try {
    const raw = await getPhrases();
    const out: CachedPhrases = {};
    for (const [key, value] of Object.entries(raw)) {
      out[key as keyof CachedPhrases] = {
        text: value.text, path: value.audio_url ? await cacheAudio(value.audio_url) : null,
      };
    }
    await setKV('phrases', out);
    await setKV('voice_signature', signature);
  } catch {
    // server or voice unavailable: tried again on the next sync
  }
}

/** Keeps >= 3 unused spoken messages per medication cached on the phone, so reminders play offline. */
export async function prefetchMessages() {
  if (!(await online())) return;
  try {
    for (const med of await listMeds()) {
      if ((await unusedMessageCount(med.id)) >= 3) continue;
      const first = med.times[0] ? Number(med.times[0].split(':')[0]) : 8;
      const batch = await fetchMessages(med.id, timeOfDay(new Date(2000, 0, 1, first)), 10);
      for (const m of batch) await addMessage(med.id, m.text, m.audio_url ? await cacheAudio(m.audio_url) : null);
    }
  } catch {
    // server or Gemma unavailable: the reminder shows text only
  }
}

/** After the person, medications or companion changed: refresh everything that depends on the voice. */
export async function syncVoice() {
  await pushConfig();
  await syncPhrases();
  await prefetchMessages();
  await refreshAlarmAudio(await listMeds());
}

export async function syncAll() {
  await syncVoice();
  await flushOutbox();
  await flushHelpQueue();
}
