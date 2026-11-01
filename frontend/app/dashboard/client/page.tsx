import { RoleGate } from '@/components/auth/RoleGate';
import { DashboardClient } from '@/components/dashboard/DashboardClient';

export default function ClientDashboardPage() {
  return (
    <RoleGate
      allowedRoles={['client']}
      title="Client Dashboard"
      description="Sign in as a client to review your funded bounties, payouts, and submission queue."
      authHref="/auth?role=client&next=/dashboard/client"
    >
      <DashboardClient />
    </RoleGate>
  );
}
