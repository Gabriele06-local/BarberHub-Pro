import { z } from "zod";

export const emailSchema = z.string().email("Email non valida");
export const passwordSchema = z.string().min(6, "Minimo 6 caratteri");

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const companyCreateSchema = z.object({
  name: z.string().min(2, "Nome troppo corto").max(120),
});

export const companyUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2, "Nome troppo corto").max(120),
});

export const companyDeleteSchema = z.object({
  id: z.string().uuid(),
});

export const assignAdminSchema = z.object({
  companyId: z.string().uuid(),
  email: emailSchema,
  name: z.string().min(2).max(120),
  password: passwordSchema,
});

export const teamMemberSchema = z.object({
  companyId: z.string().uuid().optional(),
  email: emailSchema,
  name: z.string().min(2).max(120),
  role: z.enum(["MANAGER", "BARBER"]),
  password: passwordSchema,
  locationId: z.string().uuid().optional(),
});

export const locationCreateSchema = z.object({
  companyId: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
});

export const clientUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  companyId: z.string().uuid(),
  locationId: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  phone: z.string().min(5).max(40),
  email: z
    .preprocess(
      (v) => (v === "" || v === undefined || v === null ? null : String(v).trim()),
      z.union([z.null(), emailSchema]),
    )
    .optional(),
  notes: z.string().max(2000).optional().nullable(),
});

const isoLike = z.string().min(4, "Data richiesta");

export const appointmentCreateSchema = z.object({
  companyId: z.string().uuid(),
  clientId: z.string().uuid(),
  barberId: z.string().uuid().nullable().optional(),
  managerId: z.string().uuid().nullable().optional(),
  serviceName: z.string().min(1).max(200),
  date: isoLike,
  status: z.enum(["pending", "confirmed", "completed"]).default("pending"),
  slotMinutes: z.coerce.number().int().min(15).max(240).default(30),
});

export const publicBookSchema = z.object({
  companyId: z.string().uuid(),
  locationId: z.string().uuid().optional(),
  barberId: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.string().uuid().optional(),
  ),
  clientName: z.string().min(1).max(120),
  clientPhone: z.string().min(5).max(40),
  clientNotes: z.string().max(2000).optional(),
  serviceName: z.string().min(1).max(200),
  date: isoLike,
  slotMinutes: z.coerce.number().int().min(15).max(240).default(30),
});

export const locationOpenSlotsReplaceSchema = z.object({
  companyId: z.string().uuid(),
  locationId: z.string().uuid(),
  slotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slotMins: z.array(z.number().int()),
});

export const paymentUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  companyId: z.string().uuid(),
  clientId: z.string().uuid(),
  locationId: z.string().uuid().optional(),
  amount: z.coerce.number().nonnegative(),
  category: z.string().min(1).max(120),
  method: z.enum(["cash", "srl", "privato"]),
  date: isoLike,
});

export const reportMonthSchema = z.object({
  companyId: z.string().uuid(),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});

export const reportYearSchema = z.object({
  companyId: z.string().uuid(),
  year: z.number().int().min(2000).max(2100),
});
