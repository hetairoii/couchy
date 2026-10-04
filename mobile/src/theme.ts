/**
 * Visual language taken from the Couchy illustrations: thick black ink outlines, warm cream paper with grain,
 * flat vintage colors and hard offset shadows (like a printed cartoon). Elderly-friendly: text >= 20pt,
 * touch targets >= 64dp, high contrast (ink on paper is ~15:1).
 */
export const colors = {
  paper: '#F2EFE0',
  paperDeep: '#E4DDC4',
  card: '#FBF8EC',
  ink: '#1A1A1A',
  muted: '#5B5546',
  primary: '#2E6B5A', // vintage green
  primaryText: '#FBF8EC',
  mustard: '#E3A72F',
  red: '#C2402B',
  blue: '#5E83AB',
  rose: '#E9B7B0',

  // names used across the app
  bg: '#F2EFE0',
  text: '#1A1A1A',
  accent: '#E3A72F',
  danger: '#C2402B',
  border: '#1A1A1A',
  taken: '#2E6B5A',
  missed: '#C2402B',
  pending: '#E3A72F',
};

export const fonts = {
  title: 'Fredoka_700Bold',
  strong: 'Fredoka_600SemiBold',
  body: 'Fredoka_500Medium',
};

export const font = { body: 20, label: 18, title: 30, huge: 40 };
export const TOUCH = 64;

/** Outline thickness, corner radius and the offset of the hard "printed" shadow. */
export const INK = 3;
export const RADIUS = 18;
export const SHADOW = 5;
