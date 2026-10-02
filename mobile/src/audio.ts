import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Directory, File, Paths } from 'expo-file-system';
import * as Speech from 'expo-speech';
import { absolute } from './api';

let current: AudioPlayer | null = null;

export function stopPlayback() {
  current?.remove();
  current = null;
  Speech.stop();
}

/** Plays a local file or remote URL. */
export async function playUri(uri: string) {
  stopPlayback();
  await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
  current = createAudioPlayer({ uri });
  current.play();
}

/** Last-resort voice when there is no cached audio (e.g. first run, no internet). */
export function speakFallback(text: string) {
  stopPlayback();
  Speech.speak(text.replace(/\[[^\]]*\]/g, '').trim(), { language: 'en-US', rate: 0.9 });
}

const audioDir = () => new Directory(Paths.document, 'voice');

/** Downloads a server audio file so it plays offline later. Returns the local uri. */
export async function cacheAudio(audioUrl: string): Promise<string | null> {
  try {
    const dir = audioDir();
    if (!dir.exists) dir.create();
    const file = await File.downloadFileAsync(absolute(audioUrl), dir, { idempotent: true });
    return file.uri;
  } catch {
    return null;
  }
}
