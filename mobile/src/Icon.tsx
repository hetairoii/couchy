import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { colors } from './theme';

export type IconName =
  | 'mic' | 'check' | 'clock' | 'pill' | 'alert' | 'skip' | 'sliders' | 'plus' | 'edit' | 'trash' | 'chart';

/** Hand-drawn style line icons: round caps and joins, same stroke as the illustrations. */
export function Icon({ name, size = 28, color = colors.ink, stroke = 2.6 }:
  { name: IconName; size?: number; color?: string; stroke?: number }) {
  const p = { stroke: color, strokeWidth: stroke, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'mic' && (<>
        <Rect x={9} y={3} width={6} height={11} rx={3} {...p} />
        <Path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" {...p} />
      </>)}
      {name === 'check' && <Path d="M4 12.5l5 5L20 6.5" {...p} />}
      {name === 'clock' && (<>
        <Circle cx={12} cy={12} r={9} {...p} />
        <Path d="M12 7v5l3.5 2" {...p} />
      </>)}
      {name === 'pill' && (
        <G rotation={-45} origin="12, 12">
          <Rect x={2} y={8} width={20} height={8} rx={4} {...p} />
          <Path d="M12 8v8" {...p} />
        </G>
      )}
      {name === 'alert' && (<>
        <Circle cx={12} cy={12} r={9.5} {...p} />
        <Path d="M12 7v6" {...p} />
        <Circle cx={12} cy={16.6} r={0.6} {...p} fill={color} />
      </>)}
      {name === 'skip' && <Path d="M6 6l12 12M18 6L6 18" {...p} />}
      {name === 'sliders' && (<>
        <Path d="M4 7h9M19 7h1M4 17h1M11 17h9" {...p} />
        <Circle cx={16} cy={7} r={2.4} {...p} />
        <Circle cx={8} cy={17} r={2.4} {...p} />
      </>)}
      {name === 'plus' && <Path d="M12 5v14M5 12h14" {...p} />}
      {name === 'edit' && <Path d="M4 20l1-4.5L16 4.5l3.5 3.5L8.5 19z M14 6.5l3.5 3.5" {...p} />}
      {name === 'trash' && <Path d="M4.5 7h15M9 7V4h6v3M6.5 7l1 13h9l1-13M10 11v6M14 11v6" {...p} />}
      {name === 'chart' && <Path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6" {...p} />}
    </Svg>
  );
}
