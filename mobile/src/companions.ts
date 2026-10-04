import type { ImageSourcePropType } from 'react-native';

export type Companion = { id: string; name: string; tagline: string; color: string; image: ImageSourcePropType };

export const COMPANIONS: Companion[] = [
  { id: 'grace', name: 'Grace', tagline: 'Warm and patient, like a favorite aunt', color: '#E9B7B0',
    image: require('../assets/characters/grace.jpg') },
  { id: 'walter', name: 'Walter', tagline: 'A calm grandfather with a gentle joke', color: '#B7C9E2',
    image: require('../assets/characters/walter.jpg') },
  { id: 'sunny', name: 'Sunny', tagline: 'Cheerful and full of energy', color: '#F6D98B',
    image: require('../assets/characters/sunny.jpg') },
  { id: 'arthur', name: 'Arthur', tagline: 'A polite British gentleman', color: '#C6D8B5',
    image: require('../assets/characters/arthur.jpg') },
];

export const companionById = (id: string) => COMPANIONS.find((c) => c.id === id) ?? COMPANIONS[0];
