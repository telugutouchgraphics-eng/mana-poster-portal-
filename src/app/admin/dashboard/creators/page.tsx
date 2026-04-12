import { CreatorInviteForm } from "@/components/creators/creator-invite-form";
import { CreatorAccessTable } from "@/components/creators/creator-access-table";

export default function AdminCreatorsPage() {
  return (
    <section className="space-y-6">
      <CreatorInviteForm actorLabel="Admin" />
      <CreatorAccessTable
        title="Creator Access Management"
        subtitle="Create creators, assign categories, control access, and mark payouts."
        showPayoutActions
      />
    </section>
  );
}
