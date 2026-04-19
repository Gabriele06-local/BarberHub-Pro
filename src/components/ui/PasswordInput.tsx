"use client";

import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { useId, useState } from "react";
import { cn } from "@/lib/utils/cn";

type PasswordInputProps = {
  name: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
};

export function PasswordInput({
  name,
  required,
  minLength,
  autoComplete,
  placeholder,
  className,
  inputClassName,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <div className={cn("relative", className)}>
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-xl bg-[#353534] py-3 pl-4 pr-11 text-sm text-[#E5E2E1] outline-none ring-red-700/40 focus:ring-2",
          inputClassName,
        )}
      />
      <button
        type="button"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-500 hover:bg-white/10 hover:text-[#E5E2E1]"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Nascondi password" : "Mostra password"}
        aria-pressed={visible}
      >
        {visible ? <EyeSlashIcon className="h-5 w-5" aria-hidden /> : <EyeIcon className="h-5 w-5" aria-hidden />}
      </button>
    </div>
  );
}
