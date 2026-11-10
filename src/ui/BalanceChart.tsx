import { useState } from "react";
import { View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import type { Cents } from "@/domain/money";
import { formatBRL } from "@/domain/money";
import { useTheme } from "./theme";

/** Trajetória do saldo no mês: linha cheia até hoje, tracejada até o fim do mês. */
export function BalanceChart({ points }: { points: { day: number; balance: Cents; projected: boolean }[] }) {
  const t = useTheme();
  const [width, setWidth] = useState(320);
  const height = 84;
  if (points.length < 2) return null;

  const values = points.map((p) => p.balance);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const lastDay = points[points.length - 1]!.day;
  const x = (day: number) => ((day - 1) / Math.max(lastDay - 1, 1)) * (width - 8) + 4;
  const y = (v: Cents) => 8 + (1 - (v - min) / span) * (height - 18);

  const real = points.filter((p) => !p.projected);
  const todayPoint = real[real.length - 1]!;
  const future = [todayPoint, ...points.filter((p) => p.projected)];
  const path = (ps: typeof points) => ps.map((p, i) => `${i ? "L" : "M"}${x(p.day).toFixed(1)} ${y(p.balance).toFixed(1)}`).join(" ");
  const end = points[points.length - 1]!;

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Saldo hoje ${formatBRL(todayPoint.balance)}, previsto para o fim do mês ${formatBRL(end.balance)}`}
    >
      <Svg width={width} height={height}>
        <Line x1={0} y1={height - 4} x2={width} y2={height - 4} stroke={t.line} strokeWidth={1} />
        <Path d={path(real)} fill="none" stroke={t.accent} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        <Path d={path(future)} fill="none" stroke={t.accent} strokeWidth={2.5} strokeDasharray="4 5" strokeLinecap="round" opacity={0.7} />
        <Line x1={x(todayPoint.day)} y1={4} x2={x(todayPoint.day)} y2={height - 4} stroke={t.line} strokeWidth={1} />
        <Circle cx={x(todayPoint.day)} cy={y(todayPoint.balance)} r={5} fill={t.card} stroke={t.accent} strokeWidth={2.5} />
        <Circle cx={x(end.day)} cy={y(end.balance)} r={3.5} fill={t.accent} />
      </Svg>
    </View>
  );
}
