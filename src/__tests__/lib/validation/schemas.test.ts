import { describe, it, expect } from "vitest";
import {
  loginSchema,
  companyCreateSchema,
  appointmentCreateSchema,
  clientUpsertSchema,
  paymentUpsertSchema,
  publicBookSchema,
} from "@/lib/validation/schemas";

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    const result = loginSchema.safeParse({ email: "test@example.com", password: "123456" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "123456" });
    expect(result.success).toBe(false);
  });

  it("rejects short password", () => {
    const result = loginSchema.safeParse({ email: "test@example.com", password: "12345" });
    expect(result.success).toBe(false);
  });
});

describe("companyCreateSchema", () => {
  it("accepts valid company name", () => {
    const result = companyCreateSchema.safeParse({ name: "My Barber Shop" });
    expect(result.success).toBe(true);
  });

  it("rejects name that is too short", () => {
    const result = companyCreateSchema.safeParse({ name: "A" });
    expect(result.success).toBe(false);
  });
});

describe("appointmentCreateSchema", () => {
  const valid = {
    companyId: "550e8400-e29b-41d4-a716-446655440000",
    clientId: "550e8400-e29b-41d4-a716-446655440001",
    serviceName: "Taglio capelli",
    date: "2025-06-23T10:00:00",
  };

  it("accepts valid appointment", () => {
    const result = appointmentCreateSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("accepts valid appointment with barberId", () => {
    const result = appointmentCreateSchema.safeParse({
      ...valid,
      barberId: "550e8400-e29b-41d4-a716-446655440002",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing required fields", () => {
    const result = appointmentCreateSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("clientUpsertSchema", () => {
  const valid = {
    companyId: "550e8400-e29b-41d4-a716-446655440000",
    name: "Mario Rossi",
    phone: "+39 333 1234567",
  };

  it("accepts valid client", () => {
    const result = clientUpsertSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("accepts client with optional email", () => {
    const result = clientUpsertSchema.safeParse({ ...valid, email: "" });
    expect(result.success).toBe(true);
  });

  it("accepts client with null email", () => {
    const result = clientUpsertSchema.safeParse({ ...valid, email: null });
    expect(result.success).toBe(true);
  });
});

describe("paymentUpsertSchema", () => {
  const valid = {
    companyId: "550e8400-e29b-41d4-a716-446655440000",
    clientId: "550e8400-e29b-41d4-a716-446655440001",
    amount: 30,
    category: "Taglio",
    method: "cash" as const,
    date: "2025-06-23",
  };

  it("accepts valid payment", () => {
    const result = paymentUpsertSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects negative amount", () => {
    const result = paymentUpsertSchema.safeParse({ ...valid, amount: -10 });
    expect(result.success).toBe(false);
  });

  it("accepts zero amount", () => {
    const result = paymentUpsertSchema.safeParse({ ...valid, amount: 0 });
    expect(result.success).toBe(true);
  });
});

describe("publicBookSchema", () => {
  const valid = {
    companyId: "550e8400-e29b-41d4-a716-446655440000",
    clientName: "Mario Rossi",
    clientPhone: "+39 333 1234567",
    serviceName: "Taglio",
    date: "2025-06-23T10:00:00",
  };

  it("accepts valid booking", () => {
    const result = publicBookSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("accepts booking with optional barberId", () => {
    const result = publicBookSchema.safeParse({
      ...valid,
      barberId: "550e8400-e29b-41d4-a716-446655440002",
    });
    expect(result.success).toBe(true);
  });
});
