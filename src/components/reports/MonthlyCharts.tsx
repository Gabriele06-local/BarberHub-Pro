"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PaymentMethod } from "@/types/domain";

const labels: Record<PaymentMethod, string> = {
  cash: "Contanti",
  srl: "SRL",
  privato: "Privato",
};

export function MonthlyCharts({
  breakdown,
}: {
  breakdown: { method: PaymentMethod; total: number }[];
}) {
  const data = breakdown.map((b) => ({
    name: labels[b.method],
    totale: Number(b.total.toFixed(2)),
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
          <XAxis dataKey="name" stroke="#a1a1aa" tick={{ fill: "#a1a1aa", fontSize: 12 }} />
          <YAxis stroke="#a1a1aa" tick={{ fill: "#a1a1aa", fontSize: 12 }} />
          <Tooltip
            contentStyle={{ background: "#201F1F", border: "none", borderRadius: 12 }}
            labelStyle={{ color: "#E5E2E1" }}
          />
          <Bar dataKey="totale" fill="#D4AF37" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
