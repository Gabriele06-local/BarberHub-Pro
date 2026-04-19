export type UserRole = "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "BARBER";

export type AppointmentStatus = "pending" | "confirmed" | "completed";

export type PaymentMethod = "cash" | "srl" | "privato";

export type Company = {
  id: string;
  name: string;
  created_at: string;
};

export type Location = {
  id: string;
  company_id: string;
  name: string;
  created_at: string;
};

export type Profile = {
  id: string;
  name: string;
  role: UserRole;
  company_id: string | null;
  location_id: string | null;
  created_at: string;
};

export type Client = {
  id: string;
  company_id: string;
  location_id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  created_at: string;
};

export type Appointment = {
  id: string;
  company_id: string;
  location_id: string;
  client_id: string;
  barber_id: string | null;
  manager_id: string | null;
  service_name: string;
  date: string;
  status: AppointmentStatus;
  created_at: string;
};

export type Payment = {
  id: string;
  company_id: string;
  location_id: string;
  client_id: string;
  amount: number;
  category: string;
  method: PaymentMethod;
  date: string;
  created_at: string;
};

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };
