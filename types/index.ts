export type QueueStatus = 'waiting' | 'queued' | 'notified' | 'arrived' | 'completed';

export interface GroupMember {
  name: string;
  phone: string;
  email: string;
}

export interface Group {
  groupNumber: number;
  members: GroupMember[];
  status: QueueStatus;
  notifiedAt?: number;
  lastResendAt?: number;
  resendCount?: number;
  confirmedAt?: number;
}

// Persisted state record per group in localStorage (via Zustand persist)
export interface GroupStateRecord {
  status: QueueStatus;
  notifiedAt?: number;       // Unix ms — when first notified; written once, never overwritten
  lastResendAt?: number;     // Unix ms — updated before each resend API call
  resendCount?: number;      // Integer — how many resends have fired
  confirmedAt?: number;      // Unix ms — set when coordinator taps "Arrived"; suppresses further resends
}

// Server enforces 60s dedup cooldown per groupNumber — no client-supplied timestamp needed
export interface NotificationRequest {
  groupNumber: number;
  members: GroupMember[];
}

export interface NotificationResponse {
  success: boolean;
  message: string;
  whatsappGroupStatus?: string;  // 'sent' | 'failed' | 'skipped' | 'simulated-success' — one per call
  results?: {
    member: string;
    emailStatus: string;         // 'sent' | 'failed' | 'simulated-success'
    whatsappDmStatus: string;    // WhatsApp DM status: 'sent' | 'failed' | 'skipped' | 'simulated-success'
  }[];
}
