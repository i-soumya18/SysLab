import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFirebaseAuthContext } from '../../hooks/useFirebaseAuth';
import { updateUserProfile } from '../../services/firebaseAuth';
import { progressApi } from '../../services/progressApi';
import type { ProgressStats } from '../../services/progressApi';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

interface UserProfile {
  id: string;
  firebaseUid: string;
  email: string;
  firstName?: string;
  lastName?: string;
  createdAt: string;
  updatedAt: string;
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, logoutUser } = useFirebaseAuthContext();

  const [displayName, setDisplayName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [progressStats, setProgressStats] = useState<ProgressStats | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Fetch user profile from backend
  useEffect(() => {
    if (!user) return;

    const fetchProfile = async () => {
      try {
        // setIsLoadingProfile(true);
        const token = await user.getIdToken();
        const response = await fetch(`${API_BASE_URL}/users/profile`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const result = await response.json();
          setProfileData(result.data);
          if (result.data.firstName) setFirstName(result.data.firstName);
          if (result.data.lastName) setLastName(result.data.lastName);
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        // setIsLoadingProfile(false);
      }
    };

    fetchProfile();
  }, [user]);

  // Fetch progress stats
  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      try {
        setIsLoadingStats(true);
        const stats = await progressApi.getProgressStats(user.uid);
        setProgressStats(stats);
      } catch (err) {
        console.error('Error fetching progress stats:', err);
      } finally {
        setIsLoadingStats(false);
      }
    };

    fetchStats();
  }, [user]);

  // Initialize display name from Firebase user
  useEffect(() => {
    if (user?.displayName) {
      setDisplayName(user.displayName);
    }
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;

    setIsSaving(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      // Update Firebase display name
      if (displayName !== user.displayName) {
        const result = await updateUserProfile(user, { displayName, photoURL: user.photoURL || undefined });
        if (result.errorMessage) {
          setErrorMessage(result.errorMessage);
          return;
        }
      }

      // Update backend profile (firstName, lastName)
      const token = await user.getIdToken();
      const response = await fetch(`${API_BASE_URL}/users/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: firstName || undefined,
          lastName: lastName || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      const result = await response.json();
      setProfileData(result.data);
      setSuccessMessage('Profile updated successfully!');
      setIsEditing(false);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error saving profile:', err);
      setErrorMessage('Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch(`${API_BASE_URL}/users/account`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete account');
      }

      // Sign out after deletion
      await logoutUser();
      navigate('/');
    } catch (err) {
      console.error('Error deleting account:', err);
      setErrorMessage('Failed to delete account. Please try again.');
    }
  };

  const getInitials = (name: string): string => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getProviderName = (providerId: string): string => {
    const providers: { [key: string]: string } = {
      'password': 'Email/Password',
      'google.com': 'Google',
      'facebook.com': 'Facebook',
      'twitter.com': 'Twitter',
      'github.com': 'GitHub',
    };
    return providers[providerId] || providerId;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Main Content */}
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
          <p className="mt-2 text-gray-600">
            Manage your account information and preferences
          </p>
        </div>

        {successMessage && (
          <div className="mb-6 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {/* Profile Card */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Personal Information</h2>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Edit Profile
              </button>
            )}
          </div>

          {/* Avatar */}
          <div className="mb-6 flex items-center gap-6">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-600 text-3xl font-bold text-white">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className="h-full w-full rounded-full object-cover" />
              ) : (
                getInitials(displayName || user?.email || 'U')
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {displayName || user?.email?.split('@')[0] || 'User'}
              </h3>
              <p className="text-sm text-gray-600">{user?.email}</p>
              {isEditing && (
                <button className="mt-2 text-sm text-blue-600 hover:text-blue-700">
                  Change Avatar (Coming Soon)
                </button>
              )}
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Name
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Your display name"
                />
              ) : (
                <p className="text-gray-900">{displayName || 'Not set'}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="First name"
                  />
                ) : (
                  <p className="text-gray-900">{firstName || 'Not set'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Last name"
                  />
                ) : (
                  <p className="text-gray-900">{lastName || 'Not set'}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <p className="text-gray-900">{user?.email}</p>
              <p className="mt-1 text-xs text-gray-500">
                Email cannot be changed. Contact support if needed.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Verified
              </label>
              <div className="flex items-center gap-2">
                {user?.emailVerified ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">
                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Not Verified
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {isEditing && (
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setDisplayName(user?.displayName || '');
                  setFirstName(profileData?.firstName || '');
                  setLastName(profileData?.lastName || '');
                  setErrorMessage('');
                }}
                className="rounded-lg border border-gray-300 px-6 py-2 font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Connected Accounts */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Connected Accounts</h2>
          <div className="space-y-3">
            {user?.providerData.map((provider) => (
              <div key={provider.providerId} className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-blue-100 p-2">
                    <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{getProviderName(provider.providerId)}</p>
                    <p className="text-sm text-gray-600">{provider.email}</p>
                  </div>
                </div>
                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                  Connected
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Account Statistics */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Account Statistics</h2>
          {isLoadingStats ? (
            <p className="text-sm text-gray-600">Loading statistics...</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <p className="text-sm text-gray-600">Member Since</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {user?.metadata.creationTime ? formatDate(user.metadata.creationTime) : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Scenarios Completed</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {progressStats?.completedScenarios || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Points</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {progressStats?.totalPoints || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Current Level</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {progressStats?.currentLevel || 1}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Danger Zone */}
        <div className="rounded-xl border-2 border-red-200 bg-red-50 p-6">
          <h2 className="text-xl font-semibold text-red-900 mb-2">Danger Zone</h2>
          <p className="text-sm text-red-700 mb-4">
            Once you delete your account, there is no going back. All your workspaces, progress, and data will be permanently deleted.
          </p>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-lg border-2 border-red-600 bg-white px-4 py-2 font-medium text-red-600 hover:bg-red-600 hover:text-white"
            >
              Delete Account
            </button>
          ) : (
            <div className="rounded-lg border border-red-300 bg-white p-4">
              <p className="mb-4 font-medium text-red-900">
                Are you absolutely sure? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleDeleteAccount}
                  className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
                >
                  Yes, Delete My Account
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
