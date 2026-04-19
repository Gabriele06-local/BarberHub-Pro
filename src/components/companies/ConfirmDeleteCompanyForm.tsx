"use client";

import { useFormStatus } from "react-dom";
import { deleteCompanyAction } from "@/actions/companies";
import { Button } from "@/components/ui/Button";

function Submit({ companyName }: { companyName: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="ghost"
      className="text-red-300 hover:text-red-200"
      disabled={pending}
    >
      {pending ? "Eliminazione…" : `Elimina “${companyName}”`}
    </Button>
  );
}

export function ConfirmDeleteCompanyForm({
  companyId,
  companyName,
}: {
  companyId: string;
  companyName: string;
}) {
  return (
    <form
      action={deleteCompanyAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Eliminare definitivamente l’azienda “${companyName}”? Verranno rimossi anche clienti, appuntamenti e pagamenti collegati (cascade). Non è possibile se ci sono ancora utenti nel team.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={companyId} />
      <Submit companyName={companyName} />
    </form>
  );
}
