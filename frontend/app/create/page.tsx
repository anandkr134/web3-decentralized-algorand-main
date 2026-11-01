import { RoleGate } from '@/components/auth/RoleGate';
import { CreateBountyClient } from '@/components/bounty/CreateBountyClient';

export default function CreateBountyPage() {
  return (
    <RoleGate
      allowedRoles={['client']}
      title="Client Bounty Launcher"
      description="Only client accounts can create and fund new bounties. Sign in with the client role to launch a fresh mission."
      authHref="/auth?role=client&next=/create"
    >
      <CreateBountyClient />
    </RoleGate>
  );
}
