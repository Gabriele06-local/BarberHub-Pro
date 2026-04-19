import { NextResponse } from "next/server";
import { z } from "zod";
import { createPublicAnonClient } from "@/lib/supabase/public-anon";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  companyId: z.string().uuid(),
  locationId: z.string().uuid(),
  fullName: z.string().min(2).max(120),
  contact: z.string().min(3).max(200),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Body non valido" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  try {
    const supabase = createPublicAnonClient();
    const { data, error } = await supabase.rpc("rpc_public_client_bookings", {
      p_company_id: parsed.data.companyId,
      p_location_id: parsed.data.locationId,
      p_full_name: parsed.data.fullName,
      p_contact: parsed.data.contact,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const raw = data as unknown;
    const row =
      typeof raw === "string"
        ? (JSON.parse(raw) as Record<string, unknown>)
        : (raw as Record<string, unknown> | null);
    if (!row || typeof row !== "object") {
      return NextResponse.json({ found: false, appointments: [] });
    }
    return NextResponse.json(
      {
        found: Boolean(row.found),
        clientName: typeof row.client_name === "string" ? row.client_name : null,
        appointments: Array.isArray(row.appointments) ? row.appointments : [],
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Errore server";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
