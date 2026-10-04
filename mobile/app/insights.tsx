import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { getInsights } from '../src/api';
import { colors, fonts, INK } from '../src/theme';
import { BigButton, Body, Card, Screen, SectionTitle } from '../src/ui';

type Insights = Awaited<ReturnType<typeof getInsights>>;

const show = (v: unknown, unit = '') => (v === null || v === undefined ? '—' : `${v}${unit}`);

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, minWidth: '46%' }}>
      <Card>
        <Text style={{ fontFamily: fonts.title, fontSize: 34, color: colors.primary }}>{value}</Text>
        <Body muted style={{ fontSize: 18, lineHeight: 24 }}>{label}</Body>
      </Card>
    </View>
  );
}

export default function InsightsScreen() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
    getInsights(days).then(setData).catch(() => setError(true));
  }, [days]);

  const m = data?.metrics;
  const wow = data?.week_over_week;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><BigButton label="7 days" variant={days === 7 ? 'primary' : 'secondary'} onPress={() => setDays(7)} /></View>
        <View style={{ flex: 1 }}><BigButton label="30 days" variant={days === 30 ? 'primary' : 'secondary'} onPress={() => setDays(30)} /></View>
      </View>
      {error && <Body muted>Could not load insights. Check the connection to the server.</Body>}
      {m && (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
            <Stat label="Pills taken" value={show(m.adherence_rate, '%')} />
            <Stat label="Taken on time (±30 min)" value={show(m.on_time_rate, '%')} />
            <Stat label="Average delay" value={show(m.mean_delay_min, ' min')} />
            <Stat label="Consistency (std dev)" value={show(m.delay_std_min, ' min')} />
            <Stat label="Time to respond" value={show(m.mean_response_min, ' min')} />
            <Stat label="Missed doses" value={show(m.missed)} />
          </View>
          {m.worst_time_slot && (
            <Card><Body>Hardest time of day: <Text style={{ fontFamily: fonts.title }}>{String(m.worst_time_slot)}</Text></Body></Card>
          )}
          {wow && wow.delta !== null && (
            <Card><Body>
              This week {show(wow.this_week, '%')} vs last week {show(wow.previous_week, '%')} ({wow.delta > 0 ? '+' : ''}{wow.delta} pts)
            </Body></Card>
          )}
          <SectionTitle>Day by day</SectionTitle>
          {data!.daily.map((d) => (
            <View key={d.day} style={{ gap: 4 }}>
              <Body muted style={{ fontSize: 18, lineHeight: 24 }}>{d.day} — {d.taken}/{d.total}</Body>
              <View style={{ height: 24, borderRadius: 12, backgroundColor: colors.card, borderWidth: INK,
                borderColor: colors.ink, overflow: 'hidden' }}>
                <View style={{ height: '100%', width: `${d.total ? (100 * d.taken) / d.total : 0}%`, backgroundColor: colors.primary }} />
              </View>
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}
