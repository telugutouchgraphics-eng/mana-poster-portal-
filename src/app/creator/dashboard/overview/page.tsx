import { redirect } from "next/navigation";

export default function CreatorOverviewRedirectPage() {
  redirect("/creator/dashboard/upload");
}
