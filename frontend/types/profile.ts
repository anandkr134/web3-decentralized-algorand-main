export type UserRole = 'client' | 'freelancer';

export interface Profile {
  id: string;
  email: string | null;
  role: UserRole | null;
  fullName?: string | null;
  walletAddress?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
