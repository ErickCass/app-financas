import Svg, { Circle, Path, Rect } from "react-native-svg";

type P = { color: string; size?: number };

export const HomeIcon = ({ color, size = 26 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  </Svg>
);

export const BudgetIcon = ({ color, size = 26 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 3a9 9 0 1 0 9 9h-9z" />
    <Path d="M15 3.5A9 9 0 0 1 20.5 9H15z" />
  </Svg>
);

export const ListIcon = ({ color, size = 26 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round">
    <Path d="M8 6h13M8 12h13M8 18h13" />
    <Circle cx={4} cy={6} r={1} />
    <Circle cx={4} cy={12} r={1} />
    <Circle cx={4} cy={18} r={1} />
  </Svg>
);

export const SparkIcon = ({ color, size = 26 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
    <Path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
  </Svg>
);

export const ChevronRight = ({ color, size = 14 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round">
    <Path d="M9 6l6 6-6 6" />
  </Svg>
);

export const ChevronLeft = ({ color, size = 22 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round">
    <Path d="M15 6l-6 6 6 6" />
  </Svg>
);

export const CardIcon = ({ color, size = 18 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round">
    <Rect x={2.5} y={5.5} width={19} height={13} rx={2.5} />
    <Path d="M2.5 10h19" />
  </Svg>
);
