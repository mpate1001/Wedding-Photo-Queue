// lib/batch-state.ts
import fs from 'fs/promises';
import path from 'path';

const STATE_PATH = path.join(process.cwd(), '.batch-state.json');

export type GroupType = 'announcements' | 'photo';

export interface GroupBatchState {
  lastRunAt: string | null;  // ISO timestamp
  lastAdded: number;
  lastFailed: number;
  totalAdded: number;
}

export interface BatchState {
  announcements: GroupBatchState;
  photo: GroupBatchState;
}

const DEFAULT_GROUP_STATE: GroupBatchState = {
  lastRunAt: null,
  lastAdded: 0,
  lastFailed: 0,
  totalAdded: 0,
};

const DEFAULT_STATE: BatchState = {
  announcements: { ...DEFAULT_GROUP_STATE },
  photo: { ...DEFAULT_GROUP_STATE },
};

/**
 * Reads the batch state from disk. Returns defaults if file doesn't exist or is invalid.
 */
export async function readBatchState(): Promise<BatchState> {
  try {
    const raw = await fs.readFile(STATE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<BatchState>;
    return {
      announcements: { ...DEFAULT_GROUP_STATE, ...parsed.announcements },
      photo: { ...DEFAULT_GROUP_STATE, ...parsed.photo },
    };
  } catch {
    return DEFAULT_STATE;
  }
}

/**
 * Writes the batch state atomically (write to tmp, rename) to avoid partial writes.
 */
export async function writeBatchState(state: BatchState): Promise<void> {
  const tmp = `${STATE_PATH}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(state, null, 2), 'utf-8');
  await fs.rename(tmp, STATE_PATH);
}

/**
 * Updates one group's state after a batch run.
 */
export async function recordBatchRun(
  groupType: GroupType,
  added: number,
  failed: number
): Promise<BatchState> {
  const state = await readBatchState();
  state[groupType] = {
    lastRunAt: new Date().toISOString(),
    lastAdded: added,
    lastFailed: failed,
    totalAdded: state[groupType].totalAdded + added,
  };
  await writeBatchState(state);
  return state;
}

/**
 * Returns true if the group had a successful batch run within the last 12 hours.
 * Used to prevent double-runs from overlapping cron triggers.
 */
export function ranWithinCooldown(groupState: GroupBatchState): boolean {
  if (!groupState.lastRunAt) return false;
  const lastRun = new Date(groupState.lastRunAt).getTime();
  const twelveHoursMs = 12 * 60 * 60 * 1000;
  return Date.now() - lastRun < twelveHoursMs;
}
