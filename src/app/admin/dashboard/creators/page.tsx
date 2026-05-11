import { CreatorInviteForm } from "@/components/creators/creator-invite-form";
import { CreatorAccessTable } from "@/components/creators/creator-access-table";

export default function AdminCreatorsPage() {
  return (
    <section className="space-y-6">
      <CreatorInviteForm actorLabel="Admin" />
      <CreatorAccessTable
        title="Creator Access Management"
        subtitle="Create creators, review bank details, control access, and manage payout stages."
        showPayoutActions
      />
    </section>
  );
}
