import { CreatorInviteForm } from "@/components/creators/creator-invite-form";
import { CreatorAccessTable } from "@/components/creators/creator-access-table";

export default function ManagerCreatorsPage() {
  return (
    <section className="space-y-6">
      <CreatorInviteForm actorLabel="Manager" />
      <CreatorAccessTable
        title="Creator Access List"
        subtitle="Create creators, assign categories, control access, and reset creator devices."
      />
    </section>
  );
}
