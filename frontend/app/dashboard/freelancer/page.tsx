import { RoleGate } from '@/components/auth/RoleGate';
import { FreelancerDashboardClient } from '@/components/dashboard/FreelancerDashboardClient';

export default function FreelancerDashboardPage() {
  return (
    <RoleGate
      allowedRoles={['freelancer']}
      title="Freelancer Dashboard"
      description="Sign in as a freelancer to track submissions, approvals, and the next live bounty to attack."
      authHref="/auth?role=freelancer&next=/dashboard/freelancer"
    >
      <FreelancerDashboardClient />
    </RoleGate>
  );
}
