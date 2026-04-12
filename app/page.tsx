'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import GroupCard from '@/components/GroupCard';
import { useQueueStore } from '@/store/queueStore';
import type { Group, QueueStatus, NotificationResponse } from '@/types';

interface GroupsApiResponse {
  groups: Group[];
}

export default function Home() {
  const router = useRouter();

  // Local UI state (kept as useState — not queue/group state)
  const [notifyingGroup, setNotifyingGroup] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<QueueStatus | 'all'>('all');
  const [testMode, setTestMode] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<Set<number>>(new Set());
  const [bulkNotifying, setBulkNotifying] = useState(false);

  // Zustand store — single source of truth for group status + queue order
  const statuses = useQueueStore((s) => s.statuses);
  const setStatus = useQueueStore((s) => s.setStatus);
  const recordResend = useQueueStore((s) => s.recordResend);
  const addToQueue = useQueueStore((s) => s.addToQueue);
  const removeFromQueue = useQueueStore((s) => s.removeFromQueue);
  const getRecord = useQueueStore((s) => s.getRecord);

  // TanStack Query — fetches raw groups from Google Sheets
  const {
    data: groupsData,
    isLoading,
    isError,
    error: queryError,
    refetch,
  } = useQuery<GroupsApiResponse>({
    queryKey: ['groups'],
    queryFn: async () => {
      const response = await fetch('/api/groups');
      if (!response.ok) throw new Error('Failed to fetch groups');
      return response.json();
    },
    enabled: authenticated,
    staleTime: 60_000,
  });

  useEffect(() => {
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (authenticated) {
      checkTestMode();
    }
  }, [authenticated]);

  const checkAuth = async () => {
    const token = localStorage.getItem('wedding_auth');

    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (data.valid) {
        setAuthenticated(true);
      } else {
        localStorage.removeItem('wedding_auth');
        router.push('/login');
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      localStorage.removeItem('wedding_auth');
      router.push('/login');
    }
  };

  const checkTestMode = async () => {
    try {
      const response = await fetch('/api/test-mode');
      const data = await response.json();
      setTestMode(data.testMode);
    } catch (err) {
      console.error('Failed to check test mode:', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('wedding_auth');
    router.push('/login');
  };

  // Merge fetched groups with persisted statuses from the Zustand store.
  // Dependencies: groupsData (server) + statuses (store). Recomputes whenever
  // either side changes, so the dashboard stays reactive.
  const groups: Group[] = useMemo(() => {
    const raw = groupsData?.groups ?? [];
    return raw.map((group) => {
      const record = statuses[group.groupNumber];
      if (!record) return { ...group, status: 'waiting' as QueueStatus };
      return {
        ...group,
        status: record.status,
        notifiedAt: record.notifiedAt,
        lastResendAt: record.lastResendAt,
        resendCount: record.resendCount,
        confirmedAt: record.confirmedAt,
      };
    });
  }, [groupsData, statuses]);

  const handleSelectGroup = (groupNumber: number, selected: boolean) => {
    setSelectedGroups((prev) => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(groupNumber);
      } else {
        newSet.delete(groupNumber);
      }
      return newSet;
    });
  };

  const handleStatusChange = (groupNumber: number, newStatus: QueueStatus) => {
    setStatus(groupNumber, newStatus);
    if (newStatus === 'queued' || newStatus === 'notified') {
      addToQueue(groupNumber);
    }
    if (newStatus === 'completed' || newStatus === 'waiting') {
      removeFromQueue(groupNumber);
    }
  };

  const handleNotify = async (group: Group) => {
    setNotifyingGroup(group.groupNumber);
    const record = getRecord(group.groupNumber);
    const lastNotifiedAt = record.lastResendAt ?? record.notifiedAt;
    const wasAlreadyNotified = record.status === 'notified';

    try {
      const response = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupNumber: group.groupNumber,
          members: group.members,
          lastNotifiedAt,
        }),
      });

      const result: NotificationResponse = await response.json();

      if (result.success) {
        if (wasAlreadyNotified) {
          // Resend path — keep status 'notified', bump lastResendAt/resendCount
          // so Phase 2's auto-resend timer reads fresh values.
          recordResend(group.groupNumber);
          toast.success(`Group ${group.groupNumber} resent`, {
            description: result.message,
          });
        } else {
          // First notify — setStatus('notified') triggers the write-once
          // notifiedAt guard in the store.
          setStatus(group.groupNumber, 'notified');
          addToQueue(group.groupNumber);
          toast.success(`Group ${group.groupNumber} notified`, {
            description: result.message,
          });
        }
      } else if (response.status === 429) {
        toast.warning(result.message);
      } else {
        toast.error(`Notification failed: ${result.message}`);
      }
    } catch (err) {
      toast.error('Failed to send notification. Check your connection.');
      console.error(err);
    } finally {
      setNotifyingGroup(null);
    }
  };

  const handleBulkNotify = async () => {
    if (selectedGroups.size === 0) {
      toast.warning('Please select at least one group to notify');
      return;
    }

    setBulkNotifying(true);

    try {
      const selectedGroupsData = groups.filter((g) => selectedGroups.has(g.groupNumber));
      let successCount = 0;
      let failCount = 0;

      for (const group of selectedGroupsData) {
        const record = getRecord(group.groupNumber);
        const lastNotifiedAt = record.lastResendAt ?? record.notifiedAt;
        const wasAlreadyNotified = record.status === 'notified';

        const response = await fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            groupNumber: group.groupNumber,
            members: group.members,
            lastNotifiedAt,
          }),
        });

        const result: NotificationResponse = await response.json();

        if (result.success) {
          successCount += 1;
          if (wasAlreadyNotified) {
            recordResend(group.groupNumber);
          } else {
            setStatus(group.groupNumber, 'notified');
            addToQueue(group.groupNumber);
          }
        } else {
          failCount += 1;
        }
      }

      if (failCount === 0) {
        toast.success(`Notified ${successCount} group(s)`);
      } else if (successCount === 0) {
        toast.error(`All ${failCount} notifications failed`);
      } else {
        toast.warning(
          `Notified ${successCount}/${selectedGroups.size} groups — ${failCount} failed`
        );
      }
      setSelectedGroups(new Set());
    } catch (err) {
      toast.error('Bulk notification failed. Please try again.');
      console.error(err);
    } finally {
      setBulkNotifying(false);
    }
  };

  const filteredGroups = groups.filter(
    (group) => filterStatus === 'all' || group.status === filterStatus
  );

  const handleSelectAll = () => {
    setSelectedGroups(new Set(filteredGroups.map((g) => g.groupNumber)));
  };

  const handleDeselectAll = () => {
    setSelectedGroups(new Set());
  };

  const stats = {
    total: groups.length,
    waiting: groups.filter((g) => g.status === 'waiting').length,
    queued: groups.filter((g) => g.status === 'queued').length,
    notified: groups.filter((g) => g.status === 'notified').length,
    arrived: groups.filter((g) => g.status === 'arrived').length,
    completed: groups.filter((g) => g.status === 'completed').length,
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading groups...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    const errorMessage =
      queryError instanceof Error
        ? queryError.message
        : 'Failed to load groups. Please check your configuration.';
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <p className="text-red-600 mb-4">{errorMessage}</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Test Mode Banner */}
        {testMode && (
          <div className="mb-6 bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">TEST</span>
              <div>
                <p className="font-bold text-yellow-900">TEST MODE ACTIVE</p>
                <p className="text-sm text-yellow-800">
                  Notifications will be simulated - no SMS/WhatsApp/Email will be sent. No credits will be used.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Wedding Photo Queue
            </h1>
            <p className="text-gray-600">Mahek &amp; Saumya&apos;s Wedding</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
          >
            Logout
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 shadow">
            <p className="text-sm text-gray-600">Total Groups</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow">
            <p className="text-sm text-gray-600">Waiting</p>
            <p className="text-2xl font-bold text-gray-600">{stats.waiting}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow">
            <p className="text-sm text-gray-600">Queued</p>
            <p className="text-2xl font-bold text-blue-600">{stats.queued}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow">
            <p className="text-sm text-gray-600">Notified</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.notified}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow">
            <p className="text-sm text-gray-600">Arrived</p>
            <p className="text-2xl font-bold text-purple-600">{stats.arrived}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow">
            <p className="text-sm text-gray-600">Completed</p>
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedGroups.size > 0 && (
          <div className="mb-4 bg-indigo-50 border-2 border-indigo-300 rounded-lg p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <p className="font-semibold text-indigo-900">
                  {selectedGroups.size} group{selectedGroups.size !== 1 ? 's' : ''} selected
                </p>
                <button
                  onClick={handleDeselectAll}
                  className="text-sm text-indigo-700 hover:text-indigo-900 underline"
                >
                  Clear selection
                </button>
              </div>
              <button
                onClick={handleBulkNotify}
                disabled={bulkNotifying}
                className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold transition-colors"
              >
                {bulkNotifying ? 'Sending...' : `Notify ${selectedGroups.size} Group${selectedGroups.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}

        {/* Filter & Refresh */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              filterStatus === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            All Groups ({stats.total})
          </button>
          <button
            onClick={() => setFilterStatus('waiting')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              filterStatus === 'waiting'
                ? 'bg-gray-600 text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Waiting ({stats.waiting})
          </button>
          <button
            onClick={() => setFilterStatus('queued')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              filterStatus === 'queued'
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Queued ({stats.queued})
          </button>
          <button
            onClick={() => setFilterStatus('notified')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              filterStatus === 'notified'
                ? 'bg-yellow-600 text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Notified ({stats.notified})
          </button>
          <button
            onClick={() => setFilterStatus('arrived')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              filterStatus === 'arrived'
                ? 'bg-purple-600 text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Arrived ({stats.arrived})
          </button>
          <button
            onClick={() => setFilterStatus('completed')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              filterStatus === 'completed'
                ? 'bg-green-600 text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Completed ({stats.completed})
          </button>
          <div className="flex-grow"></div>
          <button
            onClick={handleSelectAll}
            className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 font-medium transition-colors"
          >
            Select All ({filteredGroups.length})
          </button>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-indigo-100 text-indigo-700 border border-indigo-300 rounded-md hover:bg-indigo-200 font-medium transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Groups Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGroups.map((group) => (
            <GroupCard
              key={group.groupNumber}
              group={group}
              record={getRecord(group.groupNumber)}
              onStatusChange={handleStatusChange}
              onNotify={handleNotify}
              isNotifying={notifyingGroup === group.groupNumber}
              isSelected={selectedGroups.has(group.groupNumber)}
              onSelect={handleSelectGroup}
            />
          ))}
        </div>

        {filteredGroups.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No groups found for this filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
