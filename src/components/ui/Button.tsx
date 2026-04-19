import { cn } from "@/lib/utils/cn";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export function Button({ className, variant = "primary", type = "button", ...props }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-transform active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none font-[family-name:var(--font-headline)] tracking-tight";

  const styles: Record<Variant, string> = {
    primary: "bg-[#B91C1C] text-[#E5E2E1] barber-red-shadow",
    secondary:
      "bg-transparent text-[#E9C349] hover:bg-gradient-to-r hover:from-[#1A1A1A] hover:to-[#2D1B14]",
    ghost: "bg-white/5 text-[#E5E2E1] backdrop-blur-md hover:bg-white/10",
  };

  return <button type={type} className={cn(base, styles[variant], className)} {...props} />;
}
