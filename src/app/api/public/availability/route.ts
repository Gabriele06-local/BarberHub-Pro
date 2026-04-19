import { NextResponse } from "next/server";
import { z } from "zod";
import {
  normalizeAvailabilitySlotRow,
  rpcJsonbToArray,
} from "@/lib/public/availability-normalize";
import { createPublicAnonClient } from "@/lib/supabase/public-anon";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  companyId: z.string().uuid(),
  locationId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slotMinutes: z.coerce.number().int().min(15).max(240).optional().default(30),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    companyId: searchParams.get("companyId") ?? "",
    locationId: searchParams.get("locationId") ?? "",
    date: searchParams.get("date") ?? "",
    slotMinutes: searchParams.get("slotMinutes") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Parametri non validi" }, { status: 400 });
  }

  try {
    const supabase = createPublicAnonClient();
    const { data, error } = await supabase.rpc("rpc_public_availability", {
      p_company_id: parsed.data.companyId,
      p_location_id: parsed.data.locationId,
      p_date: parsed.data.date,
      p_slot_minutes: parsed.data.slotMinutes,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const rows = rpcJsonbToArray(data);
    const slots = rows
      .map((x) => normalizeAvailabilitySlotRow(x))
      .filter((s): s is NonNullable<typeof s> => s !== null);
    return NextResponse.json(
      { slots },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Errore server";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
