import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { sendHelp } from './api';
import { playPhrase } from './audio';
import { queueHelp } from './sync';
import { colors } from './theme';
import { useVoiceRecorder } from './useVoiceRecorder';
import { BigButton, Body, Card } from './ui';

type State = 'idle' | 'recording' | 'sending' | 'sent' | 'failed';

/**
 * "I need help": tap, say what is happening, tap again. Every relative linked on Telegram gets an urgent
 * message and the voice note. If there is no microphone or no internet the request is still delivered (text only)
 * or retried as soon as the phone is online.
 */
export function HelpButton() {
  const [state, setState] = useState<State>('idle');
  const [notice, setNotice] = useState('');
  const finishing = useRef(false);
  const { recording, start, stop } = useVoiceRecorder(60_000, () => void finish());

  async function deliver(uri: string | null) {
    setState('sending');
    try {
      const r = await sendHelp(uri);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNotice(r.notified > 0
        ? 'Your family has been told. They will contact you very soon.'
        : 'No family member is connected yet. Please call someone you trust.');
      setState('sent');
      if (r.notified > 0) void playPhrase('help_sent');
    } catch (e) {
      if (e instanceof TypeError) { // no internet: keep it and retry automatically
        await queueHelp(uri);
        setNotice('No internet. We will keep trying. Please call your family now.');
      } else {
        setNotice('We could not reach your family. Please call them now.');
      }
      setState('failed');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  async function finish() {
    if (finishing.current) return;
    finishing.current = true;
    const rec = await stop();
    await deliver(rec?.uri ?? null);
    finishing.current = false;
  }

  async function onPress() {
    if (state === 'sending') return;
    if (state === 'recording') return finish();
    setNotice('');
    const ok = await start();
    if (ok) {
      setState('recording');
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } else {
      await deliver(null); // no microphone: still alert the family
    }
  }

  const label = state === 'sending' ? 'Sending...' : recording ? 'Tap here to send' : 'I need help';

  return (
    <>
      <BigButton big variant="danger" icon="alert" label={label} onPress={onPress} disabled={state === 'sending'} />
      {recording && (
        <Card style={{ borderColor: colors.red }}>
          <Body>Recording... Tell your family what is happening, then tap the red button again.</Body>
        </Card>
      )}
      {!!notice && !recording && <Card><Body>{notice}</Body></Card>}
    </>
  );
}
