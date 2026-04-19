import { redirect } from "next/navigation";

export default async function MonthlyReportRedirectPage() {
  redirect("/reports");
}
