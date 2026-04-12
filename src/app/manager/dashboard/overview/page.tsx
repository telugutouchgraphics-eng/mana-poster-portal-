import { redirect } from "next/navigation";

export default function ManagerOverviewRedirectPage() {
  redirect("/manager/dashboard/invite-creator");
}
