import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { prepareDose } from '../src/reminders';

/** Entry point of the native alarm (couchy://alarm?medId=...&time=HH:MM): opens the dose screen of that reminder. */
export default function AlarmEntry() {
  const { medId, time } = useLocalSearchParams<{ medId?: string; time?: string }>();

  useEffect(() => {
    (async () => {
      const id = await prepareDose({ medId, time });
      if (id) router.replace({ pathname: '/dose/[id]', params: { id, fromAlarm: '1' } });
      else router.replace('/');
    })();
  }, [medId, time]);

  return null;
}
