'use client';

import { useState, useEffect } from 'react';
import GroupCard from '@/components/GroupCard';
import type { Group, QueueStatus } from '@/types';

export default function Home() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notifyingGroup, setNotifyingGroup] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<QueueStatus | 'all'>('all');
  const [testMode, setTestMode] = useState(false);

  useEffect(() => {
    fetchGroups();
    checkTestMode();
  }, []);

  const checkTestMode = async () => {
    try {
      const response = await fetch('/api/test-mode');
      const data = await response.json();
      setTestMode(data.testMode);
    } catch (err) {
      console.error('Failed to check test mode:', err);
    }
  };

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/groups');
      if (!response.ok) throw new Error('Failed to fetch groups');

      const data = await response.json();

      // Load saved statuses from localStorage
      const savedStatuses = localStorage.getItem('groupStatuses');
      const statusMap = savedStatuses ? JSON.parse(savedStatuses) : {};

      const groupsWithStatus = data.groups.map((group: Group) => ({
        ...group,
        status: statusMap[group.groupNumber] || 'waiting',
      }));

      setGroups(groupsWithStatus);
      setError(null);
    } catch (err) {
      setError('Failed to load groups. Please check your configuration.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (groupNumber: number, newStatus: QueueStatus) => {
    setGroups((prev) =>
      prev.map((group) =>
        group.groupNumber === groupNumber ? { ...group, status: newStatus } : group
      )
    );

    // Save to localStorage
    const statusMap: Record<number, QueueStatus> = {};
    groups.forEach((group) => {
      statusMap[group.groupNumber] =
        group.groupNumber === groupNumber ? newStatus : group.status;
    });
    localStorage.setItem('groupStatuses', JSON.stringify(statusMap));
  };

  const handleNotify = async (group: Group) => {
    setNotifyingGroup(group.groupNumber);

    try {
      const response = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupNumber: group.groupNumber,
          members: group.members,
        }),
      });

      const result = await response.json();

      if (result.success) {
        handleStatusChange(group.groupNumber, 'notified');

        // Show detailed results
        let detailMessage = `✅ ${result.message}\n\n`;
        if (result.results && result.results.length > 0) {
          result.results.forEach((r: any) => {
            detailMessage += `${r.member}:\n`;
            detailMessage += `  SMS: ${r.smsStatus}\n`;
            detailMessage += `  WhatsApp: ${r.whatsappStatus}\n`;
            detailMessage += `  Email: ${r.emailStatus}\n\n`;
          });
        }
        alert(detailMessage);
      } else {
        let errorMessage = `⚠️ ${result.message}\n\n`;
        if (result.results && result.results.length > 0) {
          result.results.forEach((r: any) => {
            errorMessage += `${r.member}:\n`;
            errorMessage += `  SMS: ${r.smsStatus}\n`;
            errorMessage += `  WhatsApp: ${r.whatsappStatus}\n`;
            errorMessage += `  Email: ${r.emailStatus}\n\n`;
          });
        }
        alert(errorMessage);
      }
    } catch (err) {
      alert('Failed to send notifications. Please try again.');
      console.error(err);
    } finally {
      setNotifyingGroup(null);
    }
  };

  const filteredGroups = groups.filter((group) =>
    filterStatus === 'all' || group.status === filterStatus
  );

  const stats = {
    total: groups.length,
    waiting: groups.filter((g) => g.status === 'waiting').length,
    queued: groups.filter((g) => g.status === 'queued').length,
    notified: groups.filter((g) => g.status === 'notified').length,
    completed: groups.filter((g) => g.status === 'completed').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading groups...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchGroups}
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
              <span className="text-2xl">🧪</span>
              <div>
                <p className="font-bold text-yellow-900">TEST MODE ACTIVE</p>
                <p className="text-sm text-yellow-800">
                  Notifications will be simulated - no SMS/WhatsApp/Email will be sent. No credits will be used.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Wedding Photo Queue
          </h1>
          <p className="text-gray-600">Mahek & Saumya's Wedding</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
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
            <p className="text-sm text-gray-600">Completed</p>
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
          </div>
        </div>

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
            📋 All Groups ({stats.total})
          </button>
          <button
            onClick={() => setFilterStatus('waiting')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              filterStatus === 'waiting'
                ? 'bg-gray-600 text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            ⏳ Waiting ({stats.waiting})
          </button>
          <button
            onClick={() => setFilterStatus('queued')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              filterStatus === 'queued'
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            📝 Queued ({stats.queued})
          </button>
          <button
            onClick={() => setFilterStatus('notified')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              filterStatus === 'notified'
                ? 'bg-yellow-600 text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            📲 Notified ({stats.notified})
          </button>
          <button
            onClick={() => setFilterStatus('completed')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              filterStatus === 'completed'
                ? 'bg-green-600 text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            ✅ Completed ({stats.completed})
          </button>
          <div className="flex-grow"></div>
          <button
            onClick={fetchGroups}
            className="px-4 py-2 bg-indigo-100 text-indigo-700 border border-indigo-300 rounded-md hover:bg-indigo-200 font-medium transition-colors"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Groups Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGroups.map((group) => (
            <GroupCard
              key={group.groupNumber}
              group={group}
              onStatusChange={handleStatusChange}
              onNotify={handleNotify}
              isNotifying={notifyingGroup === group.groupNumber}
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
