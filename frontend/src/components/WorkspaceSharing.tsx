/**
 * Workspace Sharing Component
 * Handles workspace sharing and collaboration features per SRS FR-1.3
 */

import React, { useState, useEffect } from 'react';
import { WorkspaceApiService, WorkspaceShare, WorkspaceCollaborator, CreateShareRequest, InviteCollaboratorRequest } from '../services/workspaceApi';

interface WorkspaceSharingProps {
  workspaceId: string;
  userId: string;
  onClose: () => void;
}

export const WorkspaceSharing: React.FC<WorkspaceSharingProps> = ({
  workspaceId,
  userId,
  onClose
}) => {
  const [shares, setShares] = useState<WorkspaceShare[]>([]);
  const [collaborators, setCollaborators] = useState<WorkspaceCollaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'shares' | 'collaborators'>('shares');

  // Share creation form state
  const [shareForm, setShareForm] = useState({
    permissionLevel: 'view' as 'view' | 'edit' | 'admin',
    expiresIn: 0, // 0 means no expiration
    isPublic: false
  });

  // Collaborator invitation form state
  const [inviteForm, setInviteForm] = useState({
    userId: '',
    permissionLevel: 'view' as 'view' | 'edit' | 'admin'
  });

  useEffect(() => {
    loadData();
  }, [workspaceId, userId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [sharesData, collaboratorsData] = await Promise.all([
        WorkspaceApiService.getWorkspaceShares(workspaceId, userId),
        WorkspaceApiService.getWorkspaceCollaborators(workspaceId, userId)
      ]);

      setShares(sharesData);
      setCollaborators(collaboratorsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sharing data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShare = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const request: CreateShareRequest = {
        sharedBy: userId,
        permissionLevel: shareForm.permissionLevel,
        isPublic: shareForm.isPublic,
        ...(shareForm.expiresIn > 0 && { expiresIn: shareForm.expiresIn * 3600 }) // Convert hours to seconds
      };

      await WorkspaceApiService.createShare(workspaceId, request);
      await loadData(); // Refresh the list
      
      // Reset form
      setShareForm({
        permissionLevel: 'view',
        expiresIn: 0,
        isPublic: false
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create share');
    }
  };

  const handleRevokeShare = async (shareId: string) => {
    try {
      await WorkspaceApiService.revokeShare(shareId, userId);
      await loadData(); // Refresh the list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke share');
    }
  };

  const handleInviteCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const request: InviteCollaboratorRequest = {
        userId: inviteForm.userId,
        invitedBy: userId,
        permissionLevel: inviteForm.permissionLevel
      };

      await WorkspaceApiService.inviteCollaborator(workspaceId, request);
      await loadData(); // Refresh the list
      
      // Reset form
      setInviteForm({
        userId: '',
        permissionLevel: 'view'
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite collaborator');
    }
  };

  const handleRemoveCollaborator = async (collaboratorUserId: string) => {
    try {
      await WorkspaceApiService.removeCollaborator(workspaceId, collaboratorUserId, userId);
      await loadData(); // Refresh the list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove collaborator');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // Could show a toast notification here
      console.log('Copied to clipboard');
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getPermissionBadgeColor = (level: string) => {
    switch (level) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'edit': return 'bg-yellow-100 text-yellow-800';
      case 'view': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'declined': return 'bg-red-100 text-red-800';
      case 'revoked': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading sharing settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Workspace Sharing</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={() => setError(null)}
                  className="text-red-400 hover:text-red-600"
                >
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex px-6">
            <button
              onClick={() => setActiveTab('shares')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'shares'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Share Links ({shares.length})
            </button>
            <button
              onClick={() => setActiveTab('collaborators')}
              className={`ml-8 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'collaborators'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Collaborators ({collaborators.length})
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {activeTab === 'shares' && (
            <div>
              {/* Create Share Form */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Create Share Link</h3>
                <form onSubmit={handleCreateShare} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Permission Level
                      </label>
                      <select
                        value={shareForm.permissionLevel}
                        onChange={(e) => setShareForm(prev => ({ ...prev, permissionLevel: e.target.value as any }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="view">View Only</option>
                        <option value="edit">Can Edit</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Expires In (hours, 0 = never)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={shareForm.expiresIn}
                        onChange={(e) => setShareForm(prev => ({ ...prev, expiresIn: parseInt(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={shareForm.isPublic}
                          onChange={(e) => setShareForm(prev => ({ ...prev, isPublic: e.target.checked }))}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Public Link</span>
                      </label>
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Create Share Link
                  </button>
                </form>
              </div>

              {/* Shares List */}
              <div className="space-y-4">
                {shares.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No share links created yet.</p>
                ) : (
                  shares.map((share) => (
                    <div key={share.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPermissionBadgeColor(share.permissionLevel)}`}>
                              {share.permissionLevel}
                            </span>
                            {share.isPublic && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                Public
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">
                            <p>Created: {formatDate(share.createdAt)}</p>
                            {share.expiresAt && (
                              <p>Expires: {formatDate(share.expiresAt)}</p>
                            )}
                            <p>Access count: {share.accessCount}</p>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => copyToClipboard(share.shareUrl || '')}
                            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                          >
                            Copy Link
                          </button>
                          <button
                            onClick={() => handleRevokeShare(share.id)}
                            className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                          >
                            Revoke
                          </button>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 font-mono bg-gray-50 p-2 rounded break-all">
                        {share.shareUrl}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'collaborators' && (
            <div>
              {/* Invite Collaborator Form */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Invite Collaborator</h3>
                <form onSubmit={handleInviteCollaborator} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        User ID or Email
                      </label>
                      <input
                        type="text"
                        value={inviteForm.userId}
                        onChange={(e) => setInviteForm(prev => ({ ...prev, userId: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter user ID or email"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Permission Level
                      </label>
                      <select
                        value={inviteForm.permissionLevel}
                        onChange={(e) => setInviteForm(prev => ({ ...prev, permissionLevel: e.target.value as any }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="view">View Only</option>
                        <option value="edit">Can Edit</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Send Invitation
                  </button>
                </form>
              </div>

              {/* Collaborators List */}
              <div className="space-y-4">
                {collaborators.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No collaborators yet.</p>
                ) : (
                  collaborators.map((collaborator) => (
                    <div key={collaborator.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="font-medium text-gray-900">{collaborator.userId}</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPermissionBadgeColor(collaborator.permissionLevel)}`}>
                              {collaborator.permissionLevel}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(collaborator.status)}`}>
                              {collaborator.status}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600">
                            <p>Invited by: {collaborator.invitedBy}</p>
                            <p>Invited: {formatDate(collaborator.invitedAt)}</p>
                            {collaborator.acceptedAt && (
                              <p>Accepted: {formatDate(collaborator.acceptedAt)}</p>
                            )}
                            {collaborator.lastAccessed && (
                              <p>Last accessed: {formatDate(collaborator.lastAccessed)}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleRemoveCollaborator(collaborator.userId)}
                            className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};