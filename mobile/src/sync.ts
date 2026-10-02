import NetInfo from '@react-native-community/netinfo';
import { cacheAudio } from './audio';
import { addMessage, dirtyDoses, getProfile, listMeds, markClean, unusedMessageCount } from './db';
import { fetchMessages, pushEvents, pushProfile, pushSchedules } from './api';
import { timeOfDay } from './doses';

let running = false;

async function online() {
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

/** Keeps >= 3 unused spoken messages per medication cached on the phone, so reminders play offline. */
export async function prefetchMessages() {
  if (!(await online())) return;
  try {
    for (const med of await listMeds()) {
      if ((await unusedMessageCount(med.id)) >= 3) continue;
      const first = med.times[0] ? Number(med.times[0].split(':')[0]) : 8;
      const batch = await fetchMessages(med.id, timeOfDay(new Date(2000, 0, 1, first)), 10);
      for (const m of batch) await addMessage(med.id, m.text, await cacheAudio(m.audio_url));
    }
  } catch {
    // server or Gemma unavailable: reminders fall back to on-device speech
  }
}

export async function syncAll() {
  await pushConfig();
  await flushOutbox();
  await prefetchMessages();
}
