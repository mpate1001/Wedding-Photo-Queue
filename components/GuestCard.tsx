// components/GuestCard.tsx
'use client';

type GuestStatus = 'joined' | 'missing' | 'no-whatsapp';

export interface GuestRow {
  name: string;
  phone: string;
  email: string;
  announcementsStatus: GuestStatus;
  photoStatus: GuestStatus;
}

interface GuestCardProps {
  guest: GuestRow;
  activeGroup: 'announcements' | 'photo';
}

const statusLabels: Record<GuestStatus, string> = {
  joined: 'Joined',
  missing: 'Missing',
  'no-whatsapp': 'No WhatsApp',
};

const statusClasses: Record<GuestStatus, string> = {
  joined: 'bg-green-100 text-green-800 border-green-300',
  missing: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'no-whatsapp': 'bg-gray-100 text-gray-700 border-gray-300',
};

export default function GuestCard({ guest, activeGroup }: GuestCardProps) {
  const status = activeGroup === 'announcements' ? guest.announcementsStatus : guest.photoStatus;
  return (
    <div className={`border-2 rounded-lg p-3 ${statusClasses[status]} transition-colors`}>
      <div className="flex justify-between items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{guest.name}</p>
          <p className="text-xs text-gray-700 truncate">{guest.phone}</p>
          <p className="text-xs text-gray-700 truncate">{guest.email}</p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/60 whitespace-nowrap">
          {statusLabels[status]}
        </span>
      </div>
    </div>
  );
}
