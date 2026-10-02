import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { doseId } from './doses';
import { listMeds } from './db';

const CHANNEL = 'dose-reminders';

export function setupNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false,
    }),
  });
}

export async function requestPermissions(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Pill reminders',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 250, 400],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Re-creates every daily/weekly reminder from the medication list. Call after any schedule change. */
export async function rescheduleAll() {
  await Notifications.cancelAllScheduledNotificationsAsync();
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
        await Notifications.scheduleNotificationAsync({
          content,
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: CHANNEL },
        });
      } else {
        for (const day of med.days) {
          await Notifications.scheduleNotificationAsync({
            content,
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: day + 1, hour, minute,
              channelId: CHANNEL,
            },
          });
        }
      }
    }
  }
}

export async function scheduleSnooze(medId: string, time: string, minutes = 10) {
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Gentle reminder', body: 'Your pills are still waiting', data: { medId, time }, sound: true },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: minutes * 60, channelId: CHANNEL,
    },
  });
}

/** The dose id a notification refers to: today's occurrence of {medId, time}. */
export function doseIdFromNotification(data: Record<string, unknown>, now = new Date()): string | null {
  if (typeof data?.medId !== 'string' || typeof data?.time !== 'string') return null;
  return doseId(data.medId, now, data.time);
}
