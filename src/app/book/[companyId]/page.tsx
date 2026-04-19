import { notFound, redirect } from "next/navigation";
import { PublicBookExperience } from "@/components/book/PublicBookExperience";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import * as companyService from "@/lib/services/company.service";

export default async function PublicBookPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  if (!isSupabaseConfigured()) {
    redirect("/setup");
  }
  const supabase = await createClient();
  const info = await companyService.getPublicCompanyInfo(supabase, companyId);
  if (!info.ok) {
    notFound();
  }
  if (!info.data.locations.length) {
    return (
      <div className="min-h-full bg-[#0F0F0F] px-4 py-16 text-center text-sm text-zinc-400">
        Prenotazioni non ancora attive per questo negozio.
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#0F0F0F] px-3 py-8 text-[#E5E2E1] sm:px-4 sm:py-12">
      <div className="mx-auto max-w-lg">
        <PublicBookExperience companyId={companyId} companyName={info.data.name} locations={info.data.locations} />
      </div>
    </div>
  );
}
