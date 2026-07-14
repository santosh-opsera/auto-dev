import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { ProfileDetailsModal } from './ProfileDetailsModal';

interface SidebarProfileSectionProps {
  collapsed: boolean;
}

export function getInitials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Profile entry pinned to the bottom of the sidebar (STL-1). Shows an
 * initials avatar, display name, and secondary identifier (email), and opens
 * an in-place profile details dialog on click. Mirrors the collapsed-mode
 * tooltip behaviour of the nav links.
 */
export function SidebarProfileSection({ collapsed }: SidebarProfileSectionProps) {
  const user = useAuthStore((state) => state.user);
  const session = useAuthStore((state) => state.session);
  const [open, setOpen] = useState(false);

  if (!user) {
    return (
      <div className="sidebar-profile is-empty">
        <span className="sidebar-profile-avatar" aria-hidden="true">
          ?
        </span>
        <span className="sidebar-profile-text">
          <span className="sidebar-profile-name">Profile unavailable</span>
        </span>
      </div>
    );
  }

  const initials = getInitials(user.displayName || user.email);

  return (
    <div className="sidebar-profile">
      <button
        type="button"
        className="sidebar-profile-trigger"
        onClick={() => setOpen(true)}
        title={collapsed ? user.displayName : undefined}
        data-tooltip={user.displayName}
        aria-haspopup="dialog"
        aria-label={`Open profile details for ${user.displayName}`}
      >
        <span className="sidebar-profile-avatar" aria-hidden="true">
          {initials}
        </span>
        <span className="sidebar-profile-text">
          <span className="sidebar-profile-name">{user.displayName}</span>
          <span className="sidebar-profile-secondary">{user.email}</span>
        </span>
      </button>
      <ProfileDetailsModal
        open={open}
        onClose={() => setOpen(false)}
        user={user}
        session={session}
      />
    </div>
  );
}
