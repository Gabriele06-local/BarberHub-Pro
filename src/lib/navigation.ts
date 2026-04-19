import type { NavItem } from "@/components/layout/AppSidebar";
import type { UserRole } from "@/types/domain";

export function navigationForRole(role: UserRole): NavItem[] {
  const base: NavItem[] = [{ href: "/dashboard", label: "Dashboard", icon: "home" }];

  if (role === "SUPER_ADMIN") {
    return [
      ...base,
      { href: "/companies", label: "Aziende", icon: "companies" },
      { href: "/reports", label: "Report", icon: "reports" },
    ];
  }

  const staff: NavItem[] = [];
  if (role === "ADMIN" || role === "MANAGER") {
    staff.push({ href: "/team", label: "Team", icon: "team" });
  }
  if (role === "ADMIN") {
    staff.push({ href: "/locations", label: "Filiali", icon: "locations" });
  }
  if (role === "MANAGER") {
    staff.push({ href: "/locations", label: "Sede", icon: "locations" });
  }

  const ops: NavItem[] = [];
  if (role === "ADMIN" || role === "MANAGER") {
    ops.push(
      { href: "/calendar", label: "Calendario", icon: "calendar" },
      { href: "/reports", label: "Report", icon: "reports" },
    );
  }

  if (role === "BARBER") {
    ops.push({ href: "/calendar", label: "Calendario", icon: "calendar" });
  }

  return [...base, ...staff, ...ops];
}
