import { useCallback, useEffect, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { alarmAvailable, alarmStatus, openAlarmSettings, type AlarmStatus, type SettingsKind } from './alarm';
import { colors } from './theme';
import { BigButton, Body, Card, Title } from './ui';

const ROWS: { key: keyof AlarmStatus; kind: SettingsKind; title: string; why: string }[] = [
  { key: 'notifications', kind: 'notifications', title: 'Notifications', why: 'Needed to show the alarm.' },
  { key: 'exactAlarm', kind: 'exactAlarm', title: 'Alarms & reminders', why: 'So it rings at the exact minute.' },
  { key: 'fullScreen', kind: 'fullScreen', title: 'Full-screen alerts', why: 'So Couchy opens over the lock screen.' },
  { key: 'dndAccess', kind: 'dnd', title: 'Do Not Disturb access', why: 'So it still rings in Do Not Disturb.' },
  { key: 'batteryUnrestricted', kind: 'battery', title: 'Unrestricted battery', why: 'So the phone never stops it.' },
];

/** Caregiver checklist: every item must be green for the alarm to ring no matter what. */
export function AlarmSetup() {
  const [status, setStatus] = useState<AlarmStatus | null>(null);
  const refresh = useCallback(() => { void alarmStatus().then(setStatus); }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh()); // back from Settings
    return () => sub.remove();
  }, [refresh]);

  if (!alarmAvailable || !status) return null;
  const allOk = ROWS.every((r) => status[r.key]);

  return (
    <View style={{ gap: 12 }}>
      <Title>Alarm setup</Title>
      <Body muted>
        {allOk ? 'All set: the reminder will ring even if the phone is muted or locked.'
          : 'Turn every item on so the reminder always rings, even if the phone is muted or locked.'}
      </Body>
      {ROWS.map((r) => {
        const ok = status[r.key];
        return (
          <Card key={r.key} style={{ borderColor: ok ? colors.primary : colors.danger, borderWidth: 2 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: ok ? colors.primary : colors.danger }}>
              {ok ? '✓ ' : '✗ '}{r.title}
            </Text>
            <Body muted>{r.why}</Body>
            {!ok && <BigButton label="Turn on" onPress={() => void openAlarmSettings(r.kind)} />}
          </Card>
        );
      })}
    </View>
  );
}
