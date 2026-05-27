import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  const headerStore = await headers();
  const host = (headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "").toLowerCase();

  if (host.startsWith("admin.")) {
    redirect("/login?as=admin&next=/admin/dashboard");
  }
  if (host.startsWith("manager.")) {
    redirect("/login?as=manager&next=/manager/dashboard");
  }
  if (host.startsWith("creator.")) {
    redirect("/login?as=creator&next=/creator/dashboard");
  }

  redirect("/login");
}
