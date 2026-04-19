import type { PaymentMethod } from "@/types/domain";

export type MonthlyReportRow = {
  id: string;
  clientName: string;
  location: string;
  amount: number;
  category: string;
  date: string;
  method: PaymentMethod;
};

export type MonthlyReportKpis = {
  totalRevenue: number;
  paymentCount: number;
  averageTicket: number;
};

export type MonthlyReport = {
  rows: MonthlyReportRow[];
  kpis: MonthlyReportKpis;
  methodBreakdown: { method: PaymentMethod; total: number }[];
};

export type AnnualReportRow = {
  month: number;
  total: number;
  cash: number;
  srl: number;
  privato: number;
  activeLocations: number;
};

/** Report unificato: mese + KPI; “sedi” = aziende distinte (SUPER_ADMIN) o sedi tenant (`location_id`). */
export type GlobalReportMonthRow = {
  month: number;
  total: number;
  cash: number;
  srl: number;
  privato: number;
  activeSites: number;
};

export type GlobalReportPaymentRow = {
  id: string;
  clientName: string;
  companyId: string;
  companyName: string;
  /** Nome sede (join su `locations`). */
  location: string;
  amount: number;
  category: string;
  date: string;
  method: PaymentMethod;
};

export type GlobalReportPayload = {
  months: GlobalReportMonthRow[];
  yearTotals: {
    total: number;
    cash: number;
    srl: number;
    privato: number;
    activeSitesYear: number;
  };
  paymentLines: GlobalReportPaymentRow[];
};
