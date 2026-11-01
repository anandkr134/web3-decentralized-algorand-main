'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bounty } from '@/types/bounty';

export function useBounties() {
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBounties = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/bounty/get');
      const data = await res.json();
      if (data.success) {
        setBounties(data.data || []);
      } else {
        setError(data.detail || data.error || 'Failed to load bounties');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBounties();
  }, [fetchBounties]);

  return { bounties, loading, error, refetch: fetchBounties };
}

export function useBounty(bountyId: string) {
  const [bounty, setBounty] = useState<Bounty | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBounty = useCallback(async () => {
    if (!bountyId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bounty/get?id=${bountyId}`);
      const data = await res.json();
      if (data.success) setBounty(data.data);
      else setError(data.detail || data.error || 'Failed to load bounty');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [bountyId]);

  useEffect(() => {
    fetchBounty();
  }, [fetchBounty]);

  return { bounty, loading, error, refetch: fetchBounty };
}
