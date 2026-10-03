import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { doseId } from './doses';
import { listMeds } from './db';

const CHANNEL = 'dose-reminders';

/** Expo Go (Android, SDK 53+) throws when expo-notifications is imported, so it is only loaded in real builds. */
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

type NotificationsModule = typeof import('expo-notifications');
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const N: NotificationsModule | null = isExpoGo ? null : require('expo-notifications');

export function setupNotifications() {
  N?.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false,
    }),
  });
}

/** Stable per build, so it is safe to call as a hook. */
export const useLastResponse = N ? N.useLastNotificationResponse : () => null;

export async function requestPermissions(): Promise<boolean> {
  if (!N) return false;
  if (Platform.OS === 'android') {
    await N.setNotificationChannelAsync(CHANNEL, {
      name: 'Pill reminders',
      importance: N.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 250, 400],
      lockscreenVisibility: N.AndroidNotificationVisibility.PUBLIC,
    });
  }
  const current = await N.getPermissionsAsync();
  if (current.granted) return true;
  return (await N.requestPermissionsAsync()).granted;
}

/** Re-creates every daily/weekly reminder from the medication list. Call after any schedule change. */
export async function rescheduleAll() {
  if (!N) return;
  await N.cancelAllScheduledNotificationsAsync();
  const meds = await listMeds();
  for (const med of meds) {
    for (const time of med.times) {
      const [hour, minute] = time.split(':').map(Number);
      const content = {
        title: `Time for your ${med.name}`,
        body: med.dosage ? `${med.dosage} - tap to open Couchy` : 'Tap to open Couchy',
        data: { medId: med.id, time },
        sound: true as const,
      };
      if (med.days.length === 7) {
        await N.scheduleNotificationAsync({
          content,
          trigger: { type: N.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: CHANNEL },
        });
      } else {
        for (const day of med.days) {
          await N.scheduleNotificationAsync({
            content,
            trigger: { type: N.SchedulableTriggerInputTypes.WEEKLY, weekday: day + 1, hour, minute, channelId: CHANNEL },
          });
        }
      }
    }
  }
}

export async function scheduleSnooze(medId: string, time: string, minutes = 10) {
  if (!N) return;
  await N.scheduleNotificationAsync({
    content: { title: 'Gentle reminder', body: 'Your pills are still waiting', data: { medId, time }, sound: true },
    trigger: { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: minutes * 60, channelId: CHANNEL },
  });
}

/** The dose id a notification refers to: today's occurrence of {medId, time}. */
export function doseIdFromNotification(data: Record<string, unknown>, now = new Date()): string | null {
  if (typeof data?.medId !== 'string' || typeof data?.time !== 'string') return null;
  return doseId(data.medId, now, data.time);
}
