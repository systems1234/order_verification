import AppShell from "@/components/AppShell";
import InvestigationsView from "@/components/InvestigationsView";

export default function OrderInvestigationsPage() {
  return (
    <AppShell>
      <InvestigationsView group="order" heading="Order Investigations" />
    </AppShell>
  );
}
