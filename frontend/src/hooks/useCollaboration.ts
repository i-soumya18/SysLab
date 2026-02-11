/**
 * React hook for real-time collaboration features
 * Implements SRS FR-10.2: Multi-user editing with cursor tracking and presence indicators
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getWebSocketService, type CollaborationOperation, type CursorPosition, type ParticipantInfo } from '../services/websocket';

interface UseCollaborationOptions {
  workspaceId: string;
  userId?: string;
  enabled?: boolean;
}

interface CollaborationState {
  participants: ParticipantInfo[];
  isConnected: boolean;
  isCollaborating: boolean;
  currentUser?: ParticipantInfo;
}

interface UseCollaborationReturn {
  // State
  collaborationState: CollaborationState;
  
  // Actions
  sendOperation: (operation: CollaborationOperation) => Promise<void>;
  updateCursor: (position: CursorPosition) => void;
  updateSelection: (selectedIds: string[]) => void;
  
  // Event handlers
  onOperationReceived: (callback: (operation: any) => void) => void;
  onCursorUpdated: (callback: (data: { userId: string; position: CursorPosition }) => void) => void;
  onSelectionUpdated: (callback: (data: { userId: string; selectedIds: string[] }) => void) => void;
  onParticipantJoined: (callback: (participant: ParticipantInfo) => void) => void;
  onParticipantLeft: (callback: (data: { userId: string }) => void) => void;
}

export function useCollaboration(options: UseCollaborationOptions): UseCollaborationReturn {
  const { workspaceId, userId, enabled = true } = options;
  
  const [collaborationState, setCollaborationState] = useState<CollaborationState>({
    participants: [],
    isConnected: false,
    isCollaborating: false
  });

  const webSocketService = getWebSocketService({
    url: import.meta.env.VITE_WEBSOCKET_URL || 'http://localhost:3000'
  });
  const eventCallbacksRef = useRef<Map<string, Function>>(new Map());
  const cursorThrottleRef = useRef<NodeJS.Timeout | null>(null);
  const selectionThrottleRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize collaboration
  useEffect(() => {
    if (!enabled || !workspaceId) {
      return;
    }

    const initializeCollaboration = async () => {
      try {
        // Get initial presence info
        const participants = await webSocketService.getPresenceInfo();
        const currentUser = participants.find(p => p.userId === userId);
        
        setCollaborationState(prev => ({
          ...prev,
          participants,
          currentUser,
          isConnected: true,
          isCollaborating: participants.length > 1
        }));
      } catch (error) {
        console.error('Failed to initialize collaboration:', error);
      }
    };

    initializeCollaboration();
  }, [enabled, workspaceId, userId, webSocketService]);

  // Setup event listeners
  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Presence updates
    const handlePresence = (data: { participants: ParticipantInfo[] }) => {
      const currentUser = data.participants.find(p => p.userId === userId);
      setCollaborationState(prev => ({
        ...prev,
        participants: data.participants,
        currentUser,
        isCollaborating: data.participants.length > 1
      }));
    };

    // Participant joined
    const handleParticipantJoined = (data: { userId: string; socketId: string; color: string }) => {
      setCollaborationState(prev => {
        const existingParticipant = prev.participants.find(p => p.userId === data.userId);
        if (existingParticipant) {
          return prev; // Already exists
        }

        const newParticipant: ParticipantInfo = {
          userId: data.userId,
          socketId: data.socketId,
          cursor: { x: 0, y: 0 },
          selection: [],
          color: data.color,
          isActive: true,
          lastSeen: new Date()
        };

        const newParticipants = [...prev.participants, newParticipant];
        
        // Call callback if registered
        const callback = eventCallbacksRef.current.get('participant-joined');
        if (callback) {
          callback(newParticipant);
        }

        return {
          ...prev,
          participants: newParticipants,
          isCollaborating: newParticipants.length > 1
        };
      });
    };

    // Participant left
    const handleParticipantLeft = (data: { userId: string }) => {
      setCollaborationState(prev => {
        const newParticipants = prev.participants.filter(p => p.userId !== data.userId);
        
        // Call callback if registered
        const callback = eventCallbacksRef.current.get('participant-left');
        if (callback) {
          callback(data);
        }

        return {
          ...prev,
          participants: newParticipants,
          isCollaborating: newParticipants.length > 1
        };
      });
    };

    // Operation received
    const handleOperationReceived = (data: { operation: any }) => {
      const callback = eventCallbacksRef.current.get('operation-received');
      if (callback) {
        callback(data.operation);
      }
    };

    // Cursor updated
    const handleCursorUpdated = (data: { userId: string; position: CursorPosition }) => {
      setCollaborationState(prev => ({
        ...prev,
        participants: prev.participants.map(p => 
          p.userId === data.userId 
            ? { ...p, cursor: data.position, lastSeen: new Date() }
            : p
        )
      }));

      const callback = eventCallbacksRef.current.get('cursor-updated');
      if (callback) {
        callback(data);
      }
    };

    // Selection updated
    const handleSelectionUpdated = (data: { userId: string; selectedIds: string[] }) => {
      setCollaborationState(prev => ({
        ...prev,
        participants: prev.participants.map(p => 
          p.userId === data.userId 
            ? { ...p, selection: data.selectedIds, lastSeen: new Date() }
            : p
        )
      }));

      const callback = eventCallbacksRef.current.get('selection-updated');
      if (callback) {
        callback(data);
      }
    };

    // Register event listeners
    webSocketService.on('collaboration:presence', handlePresence);
    webSocketService.on('collaboration:participant-joined', handleParticipantJoined);
    webSocketService.on('collaboration:participant-left', handleParticipantLeft);
    webSocketService.on('collaboration:operation-applied', handleOperationReceived);
    webSocketService.on('collaboration:cursor-updated', handleCursorUpdated);
    webSocketService.on('collaboration:selection-updated', handleSelectionUpdated);

    // Cleanup
    return () => {
      webSocketService.off('collaboration:presence', handlePresence);
      webSocketService.off('collaboration:participant-joined', handleParticipantJoined);
      webSocketService.off('collaboration:participant-left', handleParticipantLeft);
      webSocketService.off('collaboration:operation-applied', handleOperationReceived);
      webSocketService.off('collaboration:cursor-updated', handleCursorUpdated);
      webSocketService.off('collaboration:selection-updated', handleSelectionUpdated);
    };
  }, [enabled, userId, webSocketService]);

  // Send collaborative operation
  const sendOperation = useCallback(async (operation: CollaborationOperation) => {
    if (!enabled) {
      return;
    }

    try {
      await webSocketService.sendCollaborationOperation(operation);
    } catch (error) {
      console.error('Failed to send collaboration operation:', error);
      throw error;
    }
  }, [enabled, webSocketService]);

  // Update cursor position (throttled)
  const updateCursor = useCallback((position: CursorPosition) => {
    if (!enabled) {
      return;
    }

    // Throttle cursor updates to avoid spam
    if (cursorThrottleRef.current) {
      clearTimeout(cursorThrottleRef.current);
    }

    cursorThrottleRef.current = setTimeout(() => {
      webSocketService.updateCursor(position);
    }, 50); // 50ms throttle
  }, [enabled, webSocketService]);

  // Update selection (throttled)
  const updateSelection = useCallback((selectedIds: string[]) => {
    if (!enabled) {
      return;
    }

    // Throttle selection updates
    if (selectionThrottleRef.current) {
      clearTimeout(selectionThrottleRef.current);
    }

    selectionThrottleRef.current = setTimeout(() => {
      webSocketService.updateSelection(selectedIds);
    }, 100); // 100ms throttle
  }, [enabled, webSocketService]);

  // Event handler registration
  const onOperationReceived = useCallback((callback: (operation: any) => void) => {
    eventCallbacksRef.current.set('operation-received', callback);
  }, []);

  const onCursorUpdated = useCallback((callback: (data: { userId: string; position: CursorPosition }) => void) => {
    eventCallbacksRef.current.set('cursor-updated', callback);
  }, []);

  const onSelectionUpdated = useCallback((callback: (data: { userId: string; selectedIds: string[] }) => void) => {
    eventCallbacksRef.current.set('selection-updated', callback);
  }, []);

  const onParticipantJoined = useCallback((callback: (participant: ParticipantInfo) => void) => {
    eventCallbacksRef.current.set('participant-joined', callback);
  }, []);

  const onParticipantLeft = useCallback((callback: (data: { userId: string }) => void) => {
    eventCallbacksRef.current.set('participant-left', callback);
  }, []);

  // Cleanup throttles on unmount
  useEffect(() => {
    return () => {
      if (cursorThrottleRef.current) {
        clearTimeout(cursorThrottleRef.current);
      }
      if (selectionThrottleRef.current) {
        clearTimeout(selectionThrottleRef.current);
      }
    };
  }, []);

  return {
    collaborationState,
    sendOperation,
    updateCursor,
    updateSelection,
    onOperationReceived,
    onCursorUpdated,
    onSelectionUpdated,
    onParticipantJoined,
    onParticipantLeft
  };
}