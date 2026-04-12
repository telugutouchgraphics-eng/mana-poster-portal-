import { ManagerCreateForm } from "@/components/admin/manager-create-form";
import { ManagerTable } from "@/components/managers/manager-table";

export default function AdminManagersPage() {
  return (
    <section className="space-y-6">
      <ManagerCreateForm />
      <ManagerTable />
    </section>
  );
}
