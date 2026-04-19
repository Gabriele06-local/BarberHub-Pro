"use client";

import {
  BanknotesIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  ChartBarIcon,
  HomeModernIcon,
  MapPinIcon,
  UserGroupIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import type { UserRole } from "@/types/domain";
import { logoutAction } from "@/actions/auth";

export type NavItem = {
  href: string;
  label: string;
  icon: "home" | "calendar" | "payments" | "reports" | "clients" | "team" | "companies" | "locations";
};

const iconMap = {
  home: HomeModernIcon,
  calendar: CalendarDaysIcon,
  payments: BanknotesIcon,
  reports: ChartBarIcon,
  clients: UsersIcon,
  team: UserGroupIcon,
  companies: BuildingOffice2Icon,
  locations: MapPinIcon,
};

function roleLine(role: UserRole): string {
  return role.replace(/_/g, " ");
}

export function AppSidebar({
  role,
  items,
  scopeSubtitle,
  mobileOpen = false,
  onNavigate,
}: {
  role: UserRole;
  items: NavItem[];
  /** MANAGER/BARBER: nome sede; ADMIN: nome azienda */
  scopeSubtitle?: string | null;
  /** Drawer mobile: visibile quando true (schermi sotto breakpoint lg) */
  mobileOpen?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-50 flex h-full w-[250px] flex-col bg-[#1C1B1B] py-6 shadow-2xl transition-transform duration-200 ease-out sm:py-8",
        "-translate-x-full pointer-events-none lg:pointer-events-auto lg:translate-x-0",
        mobileOpen && "translate-x-0 pointer-events-auto",
      )}
    >
      <div className="mb-10 px-6">
        <p className="font-[family-name:var(--font-headline)] text-2xl font-black tracking-tighter text-red-600">
          BarberHub
        </p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Pro · {roleLine(role)}
        </p>
        {scopeSubtitle ? (
          <p
            className="mt-2 line-clamp-2 text-xs font-medium normal-case tracking-normal text-zinc-400"
            title={scopeSubtitle}
          >
            {scopeSubtitle}
          </p>
        ) : null}
      </div>

      <nav id="app-sidebar-nav" className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 pb-4">
        {items.map((item) => {
          const Icon = iconMap[item.icon];
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onNavigate?.()}
              className={cn(
                "flex items-center rounded-lg py-3 pl-4 text-sm font-semibold transition-all",
                active
                  ? "border-l-4 border-red-700 bg-[#2A2A2A]/40 pl-3 text-red-500"
                  : "border-l-4 border-transparent text-zinc-500 hover:bg-[#2A2A2A] hover:text-zinc-200",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="ml-3 font-[family-name:var(--font-headline)]">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-3">
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-500 hover:bg-[#2A2A2A] hover:text-zinc-200"
          >
            Esci
          </button>
        </form>
      </div>
    </aside>
  );
}
