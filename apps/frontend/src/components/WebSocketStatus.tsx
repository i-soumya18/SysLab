import React from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

interface WebSocketStatusProps {
  className?: string;
  showDetails?: boolean;
}

export const WebSocketStatus: React.FC<WebSocketStatusProps> = ({ 
  className = '', 
  showDetails = false 
}) => {
  const { connectionStatus, isConnected, isConnecting, connectionError, workspaceUsers } = useWebSocket();

  const getStatusColor = () => {
    if (isConnected) return 'text-green-600';
    if (isConnecting) return 'text-yellow-600';
    if (connectionError) return 'text-red-600';
    return 'text-gray-600';
  };

  const getStatusText = () => {
    if (isConnected) return 'Connected';
    if (isConnecting) return 'Connecting...';
    if (connectionError) return 'Disconnected';
    return 'Not connected';
  };

  const getStatusIcon = () => {
    if (isConnected) return '🟢';
    if (isConnecting) return '🟡';
    if (connectionError) return '🔴';
    return '⚪';
  };

  return (
    <div className={`websocket-status ${className}`}>
      <div className="flex items-center space-x-2">
        <span className="text-sm">{getStatusIcon()}</span>
        <span className={`text-sm font-medium ${getStatusColor()}`}>
          {getStatusText()}
        </span>
        {workspaceUsers.length > 0 && (
          <span className="text-xs text-gray-500">
            ({workspaceUsers.length} user{workspaceUsers.length !== 1 ? 's' : ''})
          </span>
        )}
      </div>
      
      {showDetails && (
        <div className="mt-2 text-xs text-gray-600">
          {connectionStatus.lastConnected && (
            <div>Last connected: {connectionStatus.lastConnected.toLocaleTimeString()}</div>
          )}
          {connectionError && (
            <div className="text-red-600 mt-1">Error: {connectionError}</div>
          )}
          {workspaceUsers.length > 0 && (
            <div className="mt-1">
              Active users: {workspaceUsers.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WebSocketStatus;