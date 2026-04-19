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
  onAdd?: (guest: GuestRow) => void;
  adding?: boolean;
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

export default function GuestCard({ guest, activeGroup, onAdd, adding = false }: GuestCardProps) {
  const status = activeGroup === 'announcements' ? guest.announcementsStatus : guest.photoStatus;
  const canAdd = status === 'missing' && !!onAdd;
  return (
    <div className={`border-2 rounded-lg p-3 ${statusClasses[status]} transition-colors`}>
      <div className="flex justify-between items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{guest.name}</p>
          <p className="text-xs text-gray-700 truncate">{guest.phone}</p>
          <p className="text-xs text-gray-700 truncate">{guest.email}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/60 whitespace-nowrap">
            {statusLabels[status]}
          </span>
          {canAdd && (
            <button
              onClick={() => onAdd?.(guest)}
              disabled={adding}
              className="text-xs font-semibold px-3 py-1.5 rounded-md bg-purple-600 text-white hover:bg-purple-700 active:bg-purple-800 disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap min-h-[32px]"
            >
              {adding ? 'Adding...' : 'Add'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
