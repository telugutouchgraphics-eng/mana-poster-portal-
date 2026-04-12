import { CreatorAccessTable } from "@/components/creators/creator-access-table";

export default function AdminCreatorsPage() {
  return (
    <CreatorAccessTable
      title="Creator Access Management"
      subtitle="Search creators, assign categories, regenerate links, reset devices, and mark payouts."
      showPayoutActions
    />
  );
}
