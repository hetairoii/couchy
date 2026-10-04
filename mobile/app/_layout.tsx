import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { openDoseFromNotification } from '../src/reminders';
import { N, rescheduleAll, setupNotifications, useLastResponse } from '../src/notifications';
import { syncAll } from '../src/sync';
import { colors } from '../src/theme';

setupNotifications();

export default function RootLayout() {
  const lastResponse = useLastResponse();

  // Cold start or tap: open the dose screen for the notification that was tapped.
  useEffect(() => {
    if (lastResponse?.notification.request.content.data) {
      void openDoseFromNotification(lastResponse.notification.request.content.data);
    }
  }, [lastResponse]);

  // Foreground delivery: stamp reminded_at without navigating away from what the user is doing.
  useEffect(() => {
    const sub = N?.addNotificationReceivedListener((n) =>
      void openDoseFromNotification(n.request.content.data ?? {}, false));
    return () => sub?.remove();
  }, []);

  // Re-arm the alarms on every start (cheap, and covers an app update) and sync with the server.
  useEffect(() => { void rescheduleAll(); void syncAll(); }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{
        headerStyle: { backgroundColor: colors.bg }, headerTitleStyle: { fontSize: 22, fontWeight: '700' },
        contentStyle: { backgroundColor: colors.bg }, headerShadowVisible: false,
      }}>
        <Stack.Screen name="index" options={{ title: 'Couchy', headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ title: 'Welcome', headerBackVisible: false }} />
        <Stack.Screen name="alarm" options={{ headerShown: false }} />
        <Stack.Screen name="meds"options={{ title: 'Medications' }} />
        <Stack.Screen name="dose/[id]" options={{ title: 'Time for your pills', headerBackVisible: false }} />
        <Stack.Screen name="settings" options={{ title: 'Caregiver settings' }} />
        <Stack.Screen name="insights" options={{ title: 'Insights' }} />
      </Stack>
    </>
  );
}
