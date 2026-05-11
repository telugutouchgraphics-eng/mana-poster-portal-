import { redirect } from "next/navigation";

export default async function AdminLandingPageSectionPage() {
  redirect("/admin/dashboard/access");
}
