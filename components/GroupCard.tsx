'use client';

import type { Group, QueueStatus, GroupStateRecord } from '@/types';

interface GroupCardProps {
  group: Group;
  /**
   * Persisted state record from the Zustand store. Optional today —
   * reserved for Phase 2 which will display notifiedAt / resendCount
   * timestamps on the card.
   */
  record?: GroupStateRecord;
  onStatusChange: (groupNumber: number, newStatus: QueueStatus) => void;
  onNotify: (group: Group) => void;
  isNotifying: boolean;
  isSelected?: boolean;
  onSelect?: (groupNumber: number, selected: boolean) => void;
}

const statusColors: Record<QueueStatus, string> = {
  waiting: 'bg-gray-100 text-gray-800 border-gray-300',
  queued: 'bg-blue-100 text-blue-800 border-blue-300',
  notified: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  arrived: 'bg-purple-100 text-purple-800 border-purple-300',
  completed: 'bg-green-100 text-green-800 border-green-300',
};

const statusLabels: Record<QueueStatus, string> = {
  waiting: 'Waiting',
  queued: 'Queued',
  notified: 'Notified',
  arrived: 'Arrived',
  completed: 'Completed',
};

export default function GroupCard({
  group,
  onStatusChange,
  onNotify,
  isNotifying,
  isSelected,
  onSelect,
}: GroupCardProps) {
  return (
    <div
      className={`border-2 rounded-lg p-4 ${statusColors[group.status]} ${
        isSelected ? 'ring-4 ring-indigo-500' : ''
      } transition-all`}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-start gap-3">
          {onSelect && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => onSelect(group.groupNumber, e.target.checked)}
              className="mt-1 h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
          )}
          <div>
            <h3 className="text-lg font-bold">Group {group.groupNumber}</h3>
            <p className="text-sm text-gray-600">
              {group.members.length} member{group.members.length !== 1 ? 's' : ''}
            </p>
          </div>
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

      <div className="flex gap-2 flex-wrap">
        {/* Status dropdown stays as a safety escape hatch for any transition */}
        <select
          value={group.status}
          onChange={(e) => onStatusChange(group.groupNumber, e.target.value as QueueStatus)}
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md bg-white min-w-0"
        >
          <option value="waiting">Waiting</option>
          <option value="queued">Queued</option>
          <option value="notified">Notified</option>
          <option value="arrived">Arrived</option>
          <option value="completed">Completed</option>
        </select>

        {/* Primary action buttons — status-aware to guide the coordinator */}
        {group.status === 'waiting' && (
          <button
            onClick={() => onStatusChange(group.groupNumber, 'queued')}
            className="px-3 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Queue
          </button>
        )}
        {(group.status === 'waiting' || group.status === 'queued') && (
          <button
            onClick={() => onNotify(group)}
            disabled={isNotifying}
            className="px-3 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isNotifying ? '...' : 'Notify'}
          </button>
        )}
        {group.status === 'notified' && (
          <>
            <button
              onClick={() => onStatusChange(group.groupNumber, 'arrived')}
              className="px-3 py-2 text-sm font-semibold text-white bg-purple-600 rounded-md hover:bg-purple-700"
            >
              Arrived
            </button>
            <button
              onClick={() => onNotify(group)}
              disabled={isNotifying}
              className="px-3 py-2 text-sm font-semibold text-white bg-yellow-600 rounded-md hover:bg-yellow-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isNotifying ? '...' : 'Resend'}
            </button>
          </>
        )}
        {group.status === 'arrived' && (
          <button
            onClick={() => onStatusChange(group.groupNumber, 'completed')}
            className="px-3 py-2 text-sm font-semibold text-white bg-green-600 rounded-md hover:bg-green-700"
          >
            Complete
          </button>
        )}
      </div>
    </div>
  );
}
