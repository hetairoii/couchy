export type DoseStatus = 'pending' | 'taken' | 'snoozed' | 'skipped' | 'missed';

export type Med = {
  id: string;
  name: string;
  dosage: string;
  instructions: string;
  color: string;
  times: string[]; // "HH:MM" device-local
  days: number[]; // 0 = Sunday ... 6 = Saturday
};

export type Dose = {
  id: string;
  medId: string;
  scheduledAt: string; // ISO UTC
  remindedAt: string | null;
  openedAt: string | null;
  takenAt: string | null;
  status: DoseStatus;
  snoozeCount: number;
  source: 'button' | 'voice';
};

export type Profile = {
  preferredName: string;
  familyNames: string[];
  likes: string[];
  routineNotes: string;
  companionId: string;
  graceMinutes: number;
  inactivityHours: number;
  quietStart: string;
  quietEnd: string;
};

export const DEFAULT_PROFILE: Profile = {
  preferredName: '',
  familyNames: [],
  likes: [],
  routineNotes: '',
  companionId: 'grace',
  graceMinutes: 60,
  inactivityHours: 3,
  quietStart: '22:00',
  quietEnd: '07:00',
};
