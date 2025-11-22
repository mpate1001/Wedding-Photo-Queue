'use client';

import { Group, QueueStatus } from '@/types';

interface GroupCardProps {
  group: Group;
  onStatusChange: (groupNumber: number, newStatus: QueueStatus) => void;
  onNotify: (group: Group) => void;
  isNotifying: boolean;
}

const statusColors = {
  waiting: 'bg-gray-100 text-gray-800 border-gray-300',
  queued: 'bg-blue-100 text-blue-800 border-blue-300',
  notified: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  completed: 'bg-green-100 text-green-800 border-green-300',
};

const statusLabels = {
  waiting: 'Waiting',
  queued: 'Queued',
  notified: 'Notified',
  completed: 'Completed',
};

export default function GroupCard({ group, onStatusChange, onNotify, isNotifying }: GroupCardProps) {
  return (
    <div className={`border-2 rounded-lg p-4 ${statusColors[group.status]} transition-colors`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-lg font-bold">Group {group.groupNumber}</h3>
          <p className="text-sm text-gray-600">{group.members.length} member{group.members.length !== 1 ? 's' : ''}</p>
        </div>
        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-white/50">
          {statusLabels[group.status]}
        </span>
      </div>

      <div className="text-sm space-y-2 mb-3 max-h-40 overflow-y-auto">
        {group.members.map((member, index) => (
          <div key={index} className="border-b border-gray-300/30 pb-2 last:border-b-0">
            <p className="font-semibold">{member.name}</p>
            <p className="text-xs">📱 {member.phone}</p>
            <p className="text-xs">📧 {member.email}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <select
          value={group.status}
          onChange={(e) => onStatusChange(group.groupNumber, e.target.value as QueueStatus)}
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md bg-white"
        >
          <option value="waiting">Waiting</option>
          <option value="queued">Queued</option>
          <option value="notified">Notified</option>
          <option value="completed">Completed</option>
        </select>

        {group.status !== 'completed' && (
          <button
            onClick={() => onNotify(group)}
            disabled={isNotifying}
            className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isNotifying ? '...' : '📲 Notify'}
          </button>
        )}
      </div>
    </div>
  );
}
