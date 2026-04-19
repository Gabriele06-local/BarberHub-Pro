import { cn } from "@/lib/utils/cn";
import type { HTMLAttributes } from "react";

type Tone = "neutral" | "gold" | "red" | "green";

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  const tones: Record<Tone, string> = {
    neutral: "bg-[#2A2A2A] text-zinc-200",
    gold: "bg-[#342800]/40 text-[#E9C349] gold-halo",
    red: "bg-[#B91C1C]/20 text-red-300",
    green: "bg-emerald-500/10 text-emerald-300",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
