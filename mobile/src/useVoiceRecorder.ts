import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { stopPlayback } from './audio';

export type Recorded = { uri: string; ms: number };

/**
 * Tap-to-start / tap-to-stop voice recorder (a held button is hard for shaky or arthritic hands).
 * Stops by itself after `maxMs` and calls `onLimit`.
 */
export function useVoiceRecorder(maxMs = 60_000, onLimit?: () => void) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const limitRef = useRef(onLimit);
  limitRef.current = onLimit;

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => clearTimer, []);

  /** Returns false when the microphone is not allowed or could not start. */
  const start = useCallback(async (): Promise<boolean> => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) return false;
      stopPlayback();
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      startedAt.current = Date.now();
      setRecording(true);
      timer.current = setTimeout(() => limitRef.current?.(), maxMs);
      return true;
    } catch {
      setRecording(false);
      return false;
    }
  }, [recorder, maxMs]);

  /** Stops and returns the file; null if nothing usable was recorded (shorter than one second). */
  const stop = useCallback(async (): Promise<Recorded | null> => {
    clearTimer();
    setRecording(false);
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch {
      return null;
    }
    const ms = Date.now() - startedAt.current;
    return recorder.uri && ms >= 1000 ? { uri: recorder.uri, ms } : null;
  }, [recorder]);

  return { recording, start, stop };
}
