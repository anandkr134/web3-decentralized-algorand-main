'use client';

import { useState, useEffect, useCallback } from 'react';
import { Submission } from '@/types/submission';
import { useWallet } from '@/hooks/useWallet';

export function useSubmissions(bountyId: string) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubmissions = useCallback(async () => {
    if (!bountyId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/submission/get?bountyId=${bountyId}`);
      const data = await res.json();
      if (data.success) setSubmissions(data.data || []);
      else setError(data.detail || data.error || 'Failed to load submissions');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [bountyId]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  return { submissions, loading, error, refetch: fetchSubmissions };
}

export function useUserSubmissions(address: string | null) {
  const { authToken } = useWallet();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubmissions = useCallback(async () => {
    if (!address) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/submission/get?submitter=${address}`, {
        headers: authToken
          ? {
              Authorization: `Bearer ${authToken}`,
            }
          : undefined,
      });
      const data = await res.json();
      if (data.success) setSubmissions(data.data || []);
      else setError(data.detail || data.error || 'Failed to load submissions');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [address, authToken]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  return { submissions, loading, error, refetch: fetchSubmissions };
}
