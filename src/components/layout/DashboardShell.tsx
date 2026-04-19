"use client";

import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AppSidebar, type NavItem } from "@/components/layout/AppSidebar";
import type { UserRole } from "@/types/domain";

export function DashboardShell({
  children,
  userName,
  role,
  items,
  scopeSubtitle,
}: {
  children: ReactNode;
  userName: string;
  role: UserRole;
  items: NavItem[];
  scopeSubtitle?: string | null;
}) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileNavOpen(false);
      }
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileNavOpen]);

  return (
    <div className="min-h-full bg-[#0F0F0F]">
      {mobileNavOpen ? (
        <button
          type="button"
          className="fixed bottom-0 left-0 right-0 top-14 z-40 bg-black/60 sm:top-16 lg:hidden"
          aria-label="Chiudi menu di navigazione"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <AppSidebar
        role={role}
        items={items}
        scopeSubtitle={scopeSubtitle}
        mobileOpen={mobileNavOpen}
        onNavigate={() => setMobileNavOpen(false)}
      />

      <div className="min-h-screen lg:ml-[250px]">
        <header className="glass-header sticky top-0 z-30 flex h-14 min-h-14 items-center gap-3 px-4 pt-[env(safe-area-inset-top,0px)] sm:h-16 sm:min-h-16 sm:px-6 lg:px-8">
          <button
            type="button"
            className="shrink-0 rounded-lg p-2 text-zinc-300 hover:bg-white/10 hover:text-[#E5E2E1] lg:hidden"
            onClick={() => setMobileNavOpen((o) => !o)}
            aria-expanded={mobileNavOpen}
            aria-controls="app-sidebar-nav"
            aria-label={mobileNavOpen ? "Chiudi menu di navigazione" : "Apri menu di navigazione"}
          >
            {mobileNavOpen ? <XMarkIcon className="h-6 w-6" aria-hidden /> : <Bars3Icon className="h-6 w-6" aria-hidden />}
          </button>
          <p className="min-w-0 flex-1 text-sm text-zinc-400">
            Bentornato,{" "}
            <span className="font-semibold break-words text-[#E5E2E1]">{userName}</span>
          </p>
        </header>
        <main className="px-4 pb-16 pt-4 sm:px-6 sm:pt-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
