import { redirect } from "next/navigation";

export default function AdminOverviewRedirectPage() {
  redirect("/admin/dashboard/create-manager");
}
