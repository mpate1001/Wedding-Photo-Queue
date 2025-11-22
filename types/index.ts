export type QueueStatus = 'waiting' | 'queued' | 'notified' | 'completed';

export interface GroupMember {
  name: string;
  phone: string;
  email: string;
}

export interface Group {
  groupNumber: number;
  members: GroupMember[];
  status: QueueStatus;
}

export interface NotificationRequest {
  groupNumber: number;
  members: GroupMember[];
}

export interface NotificationResponse {
  success: boolean;
  message: string;
  results?: {
    member: string;
    smsStatus?: string;
    whatsappStatus?: string;
    emailStatus?: string;
  }[];
}
