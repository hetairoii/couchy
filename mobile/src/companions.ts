export type Companion = { id: string; name: string; tagline: string; color: string; avatar: string };

export const COMPANIONS: Companion[] = [
  { id: 'grace', name: 'Grace', tagline: 'Warm and patient, like a favorite aunt', color: '#E9B7B0', avatar: '👵' },
  { id: 'walter', name: 'Walter', tagline: 'A calm grandfather with a gentle joke', color: '#B7C9E2', avatar: '👴' },
  { id: 'sunny', name: 'Sunny', tagline: 'Cheerful and full of energy', color: '#F6D98B', avatar: '🌞' },
  { id: 'arthur', name: 'Arthur', tagline: 'A polite British gentleman', color: '#C6D8B5', avatar: '🎩' },
];

export const companionById = (id: string) => COMPANIONS.find((c) => c.id === id) ?? COMPANIONS[0];
