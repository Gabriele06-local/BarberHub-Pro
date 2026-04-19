"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnnualReportRow } from "@/types/reports";

const months = [
  "Gen",
  "Feb",
  "Mar",
  "Apr",
  "Mag",
  "Giu",
  "Lug",
  "Ago",
  "Set",
  "Ott",
  "Nov",
  "Dic",
];

export function AnnualCharts({ rows }: { rows: AnnualReportRow[] }) {
  const data = rows.map((r) => ({
    name: months[r.month - 1] ?? r.month,
    Contanti: r.cash,
    SRL: r.srl,
    Privato: r.privato,
  }));

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
          <XAxis dataKey="name" stroke="#a1a1aa" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
          <YAxis stroke="#a1a1aa" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: "#201F1F", border: "none", borderRadius: 12 }}
            labelStyle={{ color: "#E5E2E1" }}
          />
          <Legend />
          <Bar dataKey="Contanti" stackId="a" fill="#D4AF37" />
          <Bar dataKey="SRL" stackId="a" fill="#B91C1C" />
          <Bar dataKey="Privato" stackId="a" fill="#6b7280" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
