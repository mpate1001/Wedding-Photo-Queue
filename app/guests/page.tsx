// app/guests/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import GuestCard, { type GuestRow } from '@/components/GuestCard';

type GroupType = 'announcements' | 'photo';
type FilterStatus = 'all' | 'joined' | 'missing' | 'no-whatsapp';

interface GroupStats {
  total: number;
  joined: number;
  missing: number;
  noWhatsapp: number;
}

interface StatusResponse {
  guests: GuestRow[];
  stats: { announcements: GroupStats; photo: GroupStats };
  lastBatchRun: { announcements: string | null; photo: string | null };
  lastBatchSummary: {
    announcements: { lastAdded: number; lastFailed: number; totalAdded: number };
    photo: { lastAdded: number; lastFailed: number; totalAdded: number };
  };
}

export default function GuestsPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [activeGroup, setActiveGroup] = useState<GroupType>('announcements');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [inviteChannel, setInviteChannel] = useState<'email' | 'whatsapp' | 'both'>('both');
  const [inviteSending, setInviteSending] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [addingPhone, setAddingPhone] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('wedding_auth');
    if (!token) {
      router.push('/login');
      return;
    }
    fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.valid) setAuthenticated(true);
        else {
          localStorage.removeItem('wedding_auth');
          router.push('/login');
        }
      })
      .catch(() => {
        localStorage.removeItem('wedding_auth');
        router.push('/login');
      });
  }, [router]);

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('wedding_auth')}`,
  });

  const { data, isLoading, isError, refetch } = useQuery<StatusResponse>({
    queryKey: ['guest-status'],
    queryFn: async () => {
      const res = await fetch('/api/guests/status', { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to load guest status');
      return res.json();
    },
    enabled: authenticated,
    staleTime: 30_000,
  });

  const activeStats = data?.stats[activeGroup] ?? { total: 0, joined: 0, missing: 0, noWhatsapp: 0 };
  const lastRun = data?.lastBatchRun[activeGroup] ?? null;
  const lastSummary = data?.lastBatchSummary[activeGroup];

  const filteredGuests = useMemo(() => {
    const guests = data?.guests ?? [];
    const statusKey = activeGroup === 'announcements' ? 'announcementsStatus' : 'photoStatus';
    if (filterStatus === 'all') return guests;
    return guests.filter((g) => g[statusKey] === filterStatus);
  }, [data, activeGroup, filterStatus]);

  const handleSendInvites = async () => {
    if (!confirm(`Send invite links to all missing ${activeGroup} guests via ${inviteChannel}?`)) return;
    setInviteSending(true);
    try {
      const res = await fetch('/api/guests/invite', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ groupType: activeGroup, channel: inviteChannel }),
      });
      const result = await res.json();
      if (res.ok) {
        toast.success(`Invites sent: ${result.sent} ok, ${result.failed} failed, ${result.skipped} no-whatsapp`);
        refetch();
      } else {
        toast.error(`Invite failed: ${result.message}`);
      }
    } catch (err) {
      toast.error('Invite request failed');
      console.error(err);
    } finally {
      setInviteSending(false);
    }
  };

  const handleRunBatch = async () => {
    if (!confirm(`Auto-add up to 50 missing guests to the ${activeGroup} group now?`)) return;
    setBatchRunning(true);
    try {
      const res = await fetch('/api/guests/add-batch', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ groupType: activeGroup, batchSize: 50 }),
      });
      const result = await res.json();
      if (res.status === 429) {
        toast.warning(`Already ran recently (last: ${result.lastRun})`);
      } else if (res.ok) {
        toast.success(`Added ${result.added}, failed ${result.failed}, ${result.remaining} remaining`);
        refetch();
      } else {
        toast.error(`Batch failed: ${result.message}`);
      }
    } catch (err) {
      toast.error('Batch request failed');
      console.error(err);
    } finally {
      setBatchRunning(false);
    }
  };

  const handleAddOne = async (guest: GuestRow) => {
    setAddingPhone(guest.phone);
    try {
      const res = await fetch('/api/guests/add-one', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ groupType: activeGroup, phone: guest.phone }),
      });
      const result = await res.json();
      if (result.outcome === 'added') {
        toast.success(`${guest.name} added to ${activeGroup}`);
        refetch();
      } else if (result.outcome === 'invited') {
        toast.info(`${guest.name}: invite DM sent (privacy-blocked)`);
        refetch();
      } else if (result.outcome === 'already-in') {
        toast.info(`${guest.name} is already in the group`);
        refetch();
      } else if (result.outcome === 'not-on-whatsapp') {
        toast.warning(`${guest.name} is not on WhatsApp`);
      } else {
        toast.error(`${guest.name}: ${result.message ?? 'add failed'}`);
      }
    } catch (err) {
      toast.error(`Add request failed for ${guest.name}`);
      console.error(err);
    } finally {
      setAddingPhone(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('wedding_auth');
    router.push('/login');
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Checking auth...</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading guest status...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 mb-4">Failed to load guests (is WhatsApp ready?)</p>
          <button onClick={() => refetch()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="sticky top-0 z-10 bg-gray-50 pt-4 pb-3 -mx-4 px-4 border-b border-gray-200 md:border-b-0 md:static md:pt-8 md:pb-0">
          <div className="flex justify-between items-center gap-2">
            <div className="min-w-0">
              <h1 className="text-2xl md:text-4xl font-bold text-gray-900 truncate">Guest Manager</h1>
              <p className="text-sm md:text-base text-gray-600 truncate">Mahek &amp; Saumya&apos;s Wedding</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Link href="/" className="px-4 py-2.5 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors whitespace-nowrap">
                &larr; Queue
              </Link>
              <button onClick={handleLogout} className="px-4 py-2.5 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">
                Logout
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-4 mb-4">
          <button
            onClick={() => setActiveGroup('announcements')}
            className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-colors min-h-[44px] ${
              activeGroup === 'announcements' ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-700'
            }`}
          >
            Announcements
          </button>
          <button
            onClick={() => setActiveGroup('photo')}
            className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-colors min-h-[44px] ${
              activeGroup === 'photo' ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-700'
            }`}
          >
            Photo Group
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2 md:gap-4 mb-4">
          <div className="bg-white rounded-lg p-3 md:p-4 shadow">
            <p className="text-xs md:text-sm text-gray-600">Total</p>
            <p className="text-xl md:text-2xl font-bold text-gray-900">{activeStats.total}</p>
          </div>
          <div className="bg-white rounded-lg p-3 md:p-4 shadow">
            <p className="text-xs md:text-sm text-gray-600">Joined</p>
            <p className="text-xl md:text-2xl font-bold text-green-600">{activeStats.joined}</p>
          </div>
          <div className="bg-white rounded-lg p-3 md:p-4 shadow">
            <p className="text-xs md:text-sm text-gray-600">Missing</p>
            <p className="text-xl md:text-2xl font-bold text-yellow-600">{activeStats.missing}</p>
          </div>
          <div className="bg-white rounded-lg p-3 md:p-4 shadow">
            <p className="text-xs md:text-sm text-gray-600">No WA</p>
            <p className="text-xl md:text-2xl font-bold text-gray-500">{activeStats.noWhatsapp}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          <select
            value={inviteChannel}
            onChange={(e) => setInviteChannel(e.target.value as 'email' | 'whatsapp' | 'both')}
            className="px-3 py-2.5 text-sm border border-gray-300 rounded-lg bg-white min-h-[44px]"
          >
            <option value="both">Email + WhatsApp DM</option>
            <option value="email">Email only</option>
            <option value="whatsapp">WhatsApp DM only</option>
          </select>
          <button
            onClick={handleSendInvites}
            disabled={inviteSending || activeStats.missing === 0}
            className="px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-gray-400 disabled:cursor-not-allowed min-h-[44px]"
          >
            {inviteSending ? 'Sending...' : `Send Invites (${activeStats.missing})`}
          </button>
          <button
            onClick={handleRunBatch}
            disabled={batchRunning || activeStats.missing === 0}
            className="px-4 py-2.5 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 active:bg-purple-800 disabled:bg-gray-400 disabled:cursor-not-allowed min-h-[44px]"
          >
            {batchRunning ? 'Adding...' : 'Auto-Add 50'}
          </button>
          <button
            onClick={() => refetch()}
            className="px-4 py-2.5 text-sm bg-indigo-100 text-indigo-700 border border-indigo-300 rounded-lg hover:bg-indigo-200 font-medium min-h-[44px]"
          >
            Refresh
          </button>
        </div>

        {lastRun && lastSummary && (
          <p className="text-xs text-gray-500 mb-4">
            Last auto-add: {new Date(lastRun).toLocaleString()} — added {lastSummary.lastAdded}, failed {lastSummary.lastFailed} (total added: {lastSummary.totalAdded})
          </p>
        )}

        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap md:overflow-visible md:pb-0 scrollbar-hide mb-4">
          {(['all', 'joined', 'missing', 'no-whatsapp'] as FilterStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3.5 py-2.5 rounded-lg font-medium transition-colors whitespace-nowrap text-sm min-h-[44px] ${
                filterStatus === s ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {s === 'all' ? 'All' : s === 'no-whatsapp' ? 'No WA' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredGuests.map((guest, idx) => (
            <GuestCard
              key={`${guest.phone}-${idx}`}
              guest={guest}
              activeGroup={activeGroup}
              onAdd={handleAddOne}
              adding={addingPhone === guest.phone}
            />
          ))}
        </div>

        {filteredGuests.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No guests match this filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
