import { router } from 'expo-router';
import { ensureDose, getDose, listMeds, updateDose } from './db';
import { doseIdFromNotification } from './notifications';
import { flushOutbox } from './sync';

/** A reminder fired or was tapped: make sure today's dose exists and is stamped as reminded. Returns its id. */
export async function prepareDose(data: Record<string, unknown>): Promise<string | null> {
  const id = doseIdFromNotification(data);
  if (!id) return null;
  const med = (await listMeds()).find((m) => m.id === data.medId);
  if (!med) return null;
  const [h, m] = String(data.time).split(':').map(Number);
  const now = new Date();
  const dose = await ensureDose(id, med.id, new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m));
  if (!dose.remindedAt) await updateDose(id, { remindedAt: now.toISOString() });
  void flushOutbox();
  return id;
}

export async function openDoseFromNotification(data: Record<string, unknown>, navigate = true) {
  const id = await prepareDose(data);
  if (id && navigate) router.push(`/dose/${id}`);
}

export const doseExists = async (id: string) => !!(await getDose(id));
