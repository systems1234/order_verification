import AppShell from "@/components/AppShell";
import InvestigationsView from "@/components/InvestigationsView";

export default function LeadInvestigationsPage() {
  return (
    <AppShell>
      <InvestigationsView group="lead" heading="Lead Investigations" />
    </AppShell>
  );
}
