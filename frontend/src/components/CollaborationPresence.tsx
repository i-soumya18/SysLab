/**
 * Collaboration Presence Component
 * Shows real-time user presence indicators per SRS FR-10.2
 */

import React from 'react';
import type { ParticipantInfo } from '../services/websocket';
import './CollaborationPresence.css';

interface CollaborationPresenceProps {
  participants: ParticipantInfo[];
  currentUserId?: string;
  maxVisible?: number;
}

interface UserCursorProps {
  participant: ParticipantInfo;
  isCurrentUser: boolean;
}

interface UserAvatarProps {
  participant: ParticipantInfo;
  size?: 'small' | 'medium' | 'large';
  showTooltip?: boolean;
}

const UserCursor: React.FC<UserCursorProps> = ({ participant, isCurrentUser }) => {
  if (isCurrentUser || !participant.isActive) {
    return null;
  }

  const cursorStyle = {
    position: 'absolute' as const,
    left: participant.cursor.x,
    top: participant.cursor.y,
    pointerEvents: 'none' as const,
    zIndex: 1000,
    transform: 'translate(-2px, -2px)'
  };

  return (
    <div style={cursorStyle} className="collaboration-cursor">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M2 2L18 8L8 12L2 18V2Z"
          fill={participant.color}
          stroke="white"
          strokeWidth="1"
        />
      </svg>
      <div 
        className="collaboration-cursor-label"
        style={{ backgroundColor: participant.color }}
      >
        {participant.userId}
      </div>
    </div>
  );
};

const UserAvatar: React.FC<UserAvatarProps> = ({ 
  participant, 
  size = 'medium', 
  showTooltip = true 
}) => {
  const sizeClasses = {
    small: 'w-6 h-6 text-xs',
    medium: 'w-8 h-8 text-sm',
    large: 'w-10 h-10 text-base'
  };

  const initials = participant.userId
    .split(' ')
    .map((name: string) => name.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const lastSeenText = React.useMemo(() => {
    const now = new Date();
    const lastSeen = new Date(participant.lastSeen);
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    
    if (diffMinutes < 1) {
      return 'Active now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else {
      const diffHours = Math.floor(diffMinutes / 60);
      return `${diffHours}h ago`;
    }
  }, [participant.lastSeen]);

  return (
    <div className="relative">
      <div
        className={`
          ${sizeClasses[size]}
          rounded-full
          flex items-center justify-center
          text-white font-medium
          border-2 border-white
          shadow-sm
          ${participant.isActive ? 'opacity-100' : 'opacity-60'}
        `}
        style={{ backgroundColor: participant.color }}
        title={showTooltip ? `${participant.userId} - ${lastSeenText}` : undefined}
      >
        {initials}
      </div>
      
      {participant.isActive && (
        <div
          className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white"
          title="Active"
        />
      )}
    </div>
  );
};

const CollaborationPresence: React.FC<CollaborationPresenceProps> = ({
  participants,
  currentUserId,
  maxVisible = 5
}) => {
  const activeParticipants = participants.filter(p => p.isActive);
  const otherParticipants = activeParticipants.filter(p => p.userId !== currentUserId);
  const visibleParticipants = otherParticipants.slice(0, maxVisible);
  const hiddenCount = Math.max(0, otherParticipants.length - maxVisible);

  if (activeParticipants.length <= 1) {
    return null; // Don't show if only current user or no users
  }

  return (
    <>
      {/* User cursors */}
      {activeParticipants.map(participant => (
        <UserCursor
          key={participant.socketId}
          participant={participant}
          isCurrentUser={participant.userId === currentUserId}
        />
      ))}

      {/* Presence indicators */}
      <div className="collaboration-presence">
        <div className="collaboration-presence-header">
          <span className="collaboration-presence-title">
            {otherParticipants.length} other{otherParticipants.length !== 1 ? 's' : ''} online
          </span>
        </div>
        
        <div className="collaboration-presence-avatars">
          {visibleParticipants.map(participant => (
            <UserAvatar
              key={participant.socketId}
              participant={participant}
              size="medium"
            />
          ))}
          
          {hiddenCount > 0 && (
            <div
              className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs font-medium border-2 border-white"
              title={`${hiddenCount} more participant${hiddenCount !== 1 ? 's' : ''}`}
            >
              +{hiddenCount}
            </div>
          )}
        </div>

        {/* Selection indicators */}
        {visibleParticipants.some(p => p.selection.length > 0) && (
          <div className="collaboration-presence-selections">
            {visibleParticipants
              .filter(p => p.selection.length > 0)
              .map(participant => (
                <div
                  key={participant.socketId}
                  className="collaboration-selection-indicator"
                  style={{ borderColor: participant.color }}
                >
                  <UserAvatar participant={participant} size="small" showTooltip={false} />
                  <span className="text-xs text-gray-600">
                    {participant.selection.length} selected
                  </span>
                </div>
              ))
            }
          </div>
        )}
      </div>
    </>
  );
};

export default CollaborationPresence;