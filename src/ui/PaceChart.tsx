import { useState } from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import type { Cents } from "@/domain/money";
import { formatBRL } from "@/domain/money";
import type { CategoryHistory, Transaction } from "@/domain/types";
import { dayOfMonth } from "@/domain/dates";
import { useTheme } from "./theme";

/**
 * Ritmo do mês da categoria: gasto acumulado real (degraus), o ritmo
 * habitual (cinza), o limite (tracejado) e a previsão até o fim do mês.
 */
export function PaceChart(props: {
  transactions: Transaction[];
  limit: Cents;
  projected: Cents;
  today: number;
  totalDays: number;
  history?: CategoryHistory;
  color: string;
}) {
  const t = useTheme();
  const [width, setWidth] = useState(320);
  const height = 170;
  const top = 18;
  const bottom = 140;

  const byDay = new Map<number, Cents>();
  for (const tx of props.transactions) {
    const d = dayOfMonth(tx.date);
    byDay.set(d, (byDay.get(d) ?? 0) - tx.amount);
  }
  const steps: { day: number; value: Cents }[] = [];
  let acc = 0;
  for (let d = 1; d <= props.today; d++) {
    acc += byDay.get(d) ?? 0;
    steps.push({ day: d, value: acc });
  }
  const habitual = props.history
    ? props.history.cumulativeShare.slice(0, props.totalDays).map((s, i) => ({ day: i + 1, value: Math.round(s * props.history!.monthlyAverage) }))
    : [];

  const maxV = Math.max(props.limit, props.projected, acc, ...habitual.map((h) => h.value), 1) * 1.08;
  const x = (day: number) => 8 + ((day - 1) / (props.totalDays - 1)) * (width - 16);
  const y = (v: Cents) => bottom - (v / maxV) * (bottom - top);

  let stepPath = `M${x(1)} ${y(0)}`;
  for (const s of steps) stepPath += ` V${y(s.value).toFixed(1)} H${x(Math.min(s.day + 1, props.today)).toFixed(1)}`;
  const hasLimit = props.limit > 0;
  const crossing = hasLimit ? steps.find((s) => s.value > props.limit) : undefined;
  const habPath = habitual.map((h, i) => `${i ? "L" : "M"}${x(h.day).toFixed(1)} ${y(h.value).toFixed(1)}`).join(" ");

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Gasto acumulado ${formatBRL(acc)} no dia ${props.today}. Limite ${formatBRL(props.limit)}. Previsto ${formatBRL(props.projected)} no fim do mês.`}
    >
      <Svg width={width} height={height}>
        <Line x1={8} y1={bottom} x2={width - 8} y2={bottom} stroke={t.line} />
{hasLimit ? (
          <>
        <Line x1={8} y1={y(props.limit)} x2={width - 8} y2={y(props.limit)} stroke={t.accent} strokeWidth={1.5} strokeDasharray="4 4" />
        <SvgText fontFamily="-apple-system, system-ui, Inter, sans-serif" x={width - 8} y={y(props.limit) - 6} fontSize={11} fill={t.accent} fontWeight="600" textAnchor="end">
          {`limite ${formatBRL(props.limit, { noCents: true })}`}
        </SvgText>
          </>
        ) : null}
        {habPath ? <Path d={habPath} fill="none" stroke={t.ink3} strokeWidth={2} strokeLinecap="round" /> : null}
        <Path
          d={`M${x(props.today)} ${y(acc)} L${x(props.totalDays)} ${y(props.projected)}`}
          stroke={props.color}
          strokeWidth={2.5}
          strokeDasharray="5 5"
          strokeLinecap="round"
        />
        <Path d={stepPath} fill="none" stroke={props.color} strokeWidth={2.5} strokeLinejoin="round" />
        <Line x1={x(props.today)} y1={top} x2={x(props.today)} y2={bottom} stroke={t.line} />
        {crossing ? <Circle cx={x(crossing.day)} cy={y(props.limit)} r={4.5} fill={t.card} stroke={props.color} strokeWidth={2} /> : null}
        <Circle cx={x(props.totalDays)} cy={y(props.projected)} r={4} fill={props.color} />
        <SvgText fontFamily="-apple-system, system-ui, Inter, sans-serif" x={8} y={158} fontSize={11} fill={t.ink2}>dia 1</SvgText>
        <SvgText fontFamily="-apple-system, system-ui, Inter, sans-serif" x={x(props.today)} y={158} fontSize={11} fill={t.ink2} textAnchor="middle">hoje</SvgText>
        <SvgText fontFamily="-apple-system, system-ui, Inter, sans-serif" x={width - 8} y={158} fontSize={11} fill={t.ink2} textAnchor="end">{String(props.totalDays)}</SvgText>
      </Svg>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
        <Legend color={props.color} label="gasto real" />
        <Legend color={props.color} label="previsto" dashed />
        {habitual.length ? <Legend color={t.ink3} label="seu ritmo habitual" /> : null}
      </View>
    </View>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View
        style={{
          width: 16,
          height: dashed ? 0 : 3,
          borderRadius: 2,
          backgroundColor: dashed ? "transparent" : color,
          borderTopWidth: dashed ? 3 : 0,
          borderStyle: dashed ? "dashed" : "solid",
          borderColor: color,
        }}
      />
      <Text style={{ fontSize: 12, color: t.ink2 }}>{label}</Text>
    </View>
  );
}

/** Primeiro dia em que o gasto acumulado passou do limite. */
export function overrunDay(transactions: Transaction[], limit: Cents): number | null {
  const sorted = [...transactions].sort((a, b) => (a.date < b.date ? -1 : 1));
  let acc = 0;
  for (const tx of sorted) {
    acc -= tx.amount;
    if (acc > limit) return dayOfMonth(tx.date);
  }
  return null;
}
