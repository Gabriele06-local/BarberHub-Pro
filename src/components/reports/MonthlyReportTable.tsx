"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/Table";
import type { MonthlyReportRow } from "@/types/reports";

type SortKey = "clientName" | "location" | "amount" | "category" | "date" | "method";

export function MonthlyReportTable({ rows }: { rows: MonthlyReportRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") {
        return dir === "asc" ? av - bv : bv - av;
      }
      const as = String(av);
      const bs = String(bv);
      return dir === "asc" ? as.localeCompare(bs) : bs.localeCompare(as);
    });
    return copy;
  }, [rows, sortKey, dir]);

  function toggle(key: SortKey) {
    if (key === sortKey) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setDir("asc");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        {(["clientName", "location", "amount", "category", "date", "method"] as SortKey[]).map((k) => (
          <Button
            key={k}
            type="button"
            variant="ghost"
            className="text-xs text-[#E9C349]"
            onClick={() => toggle(k)}
          >
            Ordina {k}
            {sortKey === k ? (dir === "asc" ? " ↑" : " ↓") : ""}
          </Button>
        ))}
      </div>
      <Table>
        <THead>
          <Tr>
            <Th>Cliente</Th>
            <Th>Sede</Th>
            <Th>Importo</Th>
            <Th>Categoria</Th>
            <Th>Data</Th>
            <Th>Metodo</Th>
          </Tr>
        </THead>
        <TBody>
          {sorted.map((r) => (
            <Tr key={r.id}>
              <Td>{r.clientName}</Td>
              <Td>{r.location}</Td>
              <Td>€ {r.amount.toFixed(2)}</Td>
              <Td>{r.category}</Td>
              <Td className="text-xs text-zinc-400">{new Date(r.date).toLocaleString("it-IT")}</Td>
              <Td>
                <Badge tone="gold" className="normal-case">
                  {r.method}
                </Badge>
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
