import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ServiceResult } from "@/types/domain";

type Params = {
  email: string;
  password: string;
  userMetadata: Record<string, unknown>;
};

/**
 * Crea utente Auth con password, oppure se l'email esiste già aggiorna password e metadata.
 */
export async function createOrUpdateAuthUserWithPassword(
  admin: SupabaseClient,
  params: Params,
): Promise<ServiceResult<{ userId: string }>> {
  const { email, password, userMetadata } = params;

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: userMetadata,
  });

  if (!created.error && created.data.user) {
    return { ok: true, data: { userId: created.data.user.id } };
  }

  const msg = created.error?.message?.toLowerCase() ?? "";
  const duplicate =
    created.error?.status === 422 ||
    msg.includes("already") ||
    msg.includes("registered") ||
    msg.includes("exists");

  if (!duplicate) {
    return { ok: false, error: created.error?.message ?? "Impossibile creare l'utente" };
  }

  const { data: listData, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) {
    return { ok: false, error: listErr.message };
  }
  const found = listData.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!found) {
    return { ok: false, error: created.error?.message ?? "Utente non trovato" };
  }

  const { error: updateErr } = await admin.auth.admin.updateUserById(found.id, {
    password,
    user_metadata: userMetadata,
    email_confirm: true,
  });
  if (updateErr) {
    return { ok: false, error: updateErr.message };
  }
  return { ok: true, data: { userId: found.id } };
}
