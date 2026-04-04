import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { QueueStatus, GroupStateRecord } from '@/types';

interface QueueStore {
  // State
  statuses: Record<number, GroupStateRecord>;
  queueOrder: number[];  // Active queue sequence — position = display order for queued/notified groups

  // Actions
  setStatus: (groupNumber: number, status: QueueStatus) => void;
  recordResend: (groupNumber: number) => void;
  requeueGroup: (groupNumber: number) => void;
  addToQueue: (groupNumber: number) => void;
  removeFromQueue: (groupNumber: number) => void;
  getRecord: (groupNumber: number) => GroupStateRecord;
  reset: () => void;
}

export const useQueueStore = create<QueueStore>()(
  persist(
    (set, get) => ({
      statuses: {},
      queueOrder: [],

      setStatus: (groupNumber, status) => {
        set((state) => {
          const existing = state.statuses[groupNumber] ?? { status: 'waiting' };
          const now = Date.now();

          let updates: Partial<GroupStateRecord> = { status };

          if (status === 'notified') {
            updates.notifiedAt = existing.notifiedAt ?? now;  // Write once — never overwrite
          } else if (status === 'arrived') {
            updates.confirmedAt = now;
          } else if (status === 'waiting' || status === 'queued') {
            // Reset timer state when moving back to waiting/queued
            updates.notifiedAt = undefined;
            updates.lastResendAt = undefined;
            updates.resendCount = undefined;
            updates.confirmedAt = undefined;
          }

          return {
            statuses: {
              ...state.statuses,
              [groupNumber]: { ...existing, ...updates },
            },
          };
        });
      },

      recordResend: (groupNumber) => {
        set((state) => {
          const existing = state.statuses[groupNumber] ?? { status: 'notified' };
          return {
            statuses: {
              ...state.statuses,
              [groupNumber]: {
                ...existing,
                lastResendAt: Date.now(),
                resendCount: (existing.resendCount ?? 0) + 1,
              },
            },
          };
        });
      },

      requeueGroup: (groupNumber) => {
        set((state) => {
          const existing = state.statuses[groupNumber] ?? { status: 'notified' };
          // Status back to queued, clear timer state so resend starts fresh
          const updated: GroupStateRecord = {
            ...existing,
            status: 'queued',
            notifiedAt: undefined,
            lastResendAt: undefined,
            resendCount: undefined,
            confirmedAt: undefined,
          };
          // Move to back of queue
          const newOrder = [
            ...state.queueOrder.filter((n) => n !== groupNumber),
            groupNumber,
          ];
          return {
            statuses: { ...state.statuses, [groupNumber]: updated },
            queueOrder: newOrder,
          };
        });
      },

      addToQueue: (groupNumber) => {
        set((state) => ({
          queueOrder: state.queueOrder.includes(groupNumber)
            ? state.queueOrder
            : [...state.queueOrder, groupNumber],
        }));
      },

      removeFromQueue: (groupNumber) => {
        set((state) => ({
          queueOrder: state.queueOrder.filter((n) => n !== groupNumber),
        }));
      },

      getRecord: (groupNumber) => {
        return get().statuses[groupNumber] ?? { status: 'waiting' };
      },

      reset: () => set({ statuses: {}, queueOrder: [] }),
    }),
    {
      name: 'wedding-queue-state',
      // Migration from old 'groupStatuses' localStorage key
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Only migrate if new store has no data yet
        if (Object.keys(state.statuses).length === 0) {
          try {
            const old = localStorage.getItem('groupStatuses');
            if (old) {
              const parsed: Record<string, string> = JSON.parse(old);
              const migrated: Record<number, GroupStateRecord> = {};
              for (const [key, val] of Object.entries(parsed)) {
                migrated[Number(key)] = { status: val as QueueStatus };
              }
              state.statuses = migrated;
            }
          } catch {
            // Migration failure is non-fatal — start fresh
          }
        }
      },
    }
  )
);
