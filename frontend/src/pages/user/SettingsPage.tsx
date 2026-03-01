import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFirebaseAuthContext } from '../../hooks/useFirebaseAuth';
import { useSEO } from '../../hooks/useSEO';
import { settingsPageSEO } from '../../config/seoPages';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';
const LOCAL_STORAGE_KEY = 'syslab:user-preferences';

// Frontend preferences interface (includes UI-only settings)
interface FrontendPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications: {
    email: boolean;
    inApp: boolean;
    productUpdates?: boolean;
    learningReminders?: boolean;
  };
  learningPace: 'slow' | 'medium' | 'fast';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  language: string;
  privacySettings: {
    shareProgress: boolean;
    showInLeaderboard: boolean;
    allowAnalytics: boolean;
  };
}

// Backend preferences interface (what gets saved to database)
interface BackendPreferences {
  theme: 'light' | 'dark' | 'system';
  learningPace: 'slow' | 'normal' | 'fast';
  difficultyPreference: 'beginner' | 'intermediate' | 'advanced';
  notifications: {
    email: boolean;
    productUpdates: boolean;
    learningReminders: boolean;
  };
}

const DEFAULT_PREFERENCES: FrontendPreferences = {
  theme: 'system',
  notifications: {
    email: true,
    inApp: true,
    productUpdates: true,
    learningReminders: true,
  },
  learningPace: 'medium',
  difficulty: 'beginner',
  language: 'en',
  privacySettings: {
    shareProgress: true,
    showInLeaderboard: true,
    allowAnalytics: true,
  },
};

export function SettingsPage() {
  useSEO(settingsPageSEO);
  
  const navigate = useNavigate();
  const { user } = useFirebaseAuthContext();

  const [preferences, setPreferences] = useState<FrontendPreferences>(DEFAULT_PREFERENCES);
  const [initialPreferences, setInitialPreferences] = useState<FrontendPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Apply theme to document
  const applyTheme = useCallback((theme: 'light' | 'dark' | 'system') => {
    const root = document.documentElement;
    
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    } else {
      root.classList.toggle('dark', theme === 'dark');
    }
    
    // Store theme preference in localStorage for persistence
    localStorage.setItem('theme', theme);
  }, []);

  // Load preferences from localStorage on mount (runs once)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as FrontendPreferences;
        setPreferences(parsed);
        setInitialPreferences(parsed);
        applyTheme(parsed.theme);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error loading preferences from localStorage:', error);
    }
  }, [applyTheme]);

  // Fetch user preferences from backend (best-effort)
  useEffect(() => {
    if (!user) return;

    const fetchPreferences = async () => {
      try {
        setIsLoading(true);
        const token = await user.getIdToken();
        const response = await fetch(`${API_BASE_URL}/users/me/preferences`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const result = await response.json();
          const backendPrefs = result.data as BackendPreferences;
          
          // Convert backend format to frontend format
          const frontendPrefs: FrontendPreferences = {
            theme: backendPrefs.theme,
            notifications: {
              email: backendPrefs.notifications.email,
              inApp: backendPrefs.notifications.email, // Map email to inApp for now
              productUpdates: backendPrefs.notifications.productUpdates,
              learningReminders: backendPrefs.notifications.learningReminders,
            },
            learningPace: backendPrefs.learningPace === 'normal' ? 'medium' : backendPrefs.learningPace,
            difficulty: backendPrefs.difficultyPreference,
            language: 'en', // Language not stored in backend yet
            privacySettings: {
              shareProgress: true, // Privacy settings not stored in backend yet
              showInLeaderboard: true,
              allowAnalytics: true,
            },
          };
          
          setPreferences(frontendPrefs);
          setInitialPreferences(frontendPrefs);
          
          // Apply theme immediately after loading preferences
          applyTheme(frontendPrefs.theme);
          // Persist merged prefs locally as well
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(frontendPrefs));
        } else if (response.status === 401) {
          // If unauthorized, silently fall back to locally stored preferences
          // This usually means the backend session is not established yet.
          // We keep whatever is already in state/localStorage so settings still "work" for the user.
          // eslint-disable-next-line no-console
          console.warn('User preferences API returned 401. Falling back to local preferences only.');
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error fetching preferences:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreferences();
  }, [user, applyTheme]);

  // Check for changes
  useEffect(() => {
    const changed = JSON.stringify(preferences) !== JSON.stringify(initialPreferences);
    setHasChanges(changed);
  }, [preferences, initialPreferences]);

  const handleSavePreferences = async () => {
    if (!user) return;

    setIsSaving(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      // Always persist to localStorage so settings feel responsive even if backend auth is missing
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(preferences));

      if (user) {
        const token = await user.getIdToken();

        // Convert frontend format to backend format
        const backendPrefs: BackendPreferences = {
          theme: preferences.theme,
          learningPace: preferences.learningPace === 'medium' ? 'normal' : preferences.learningPace,
          difficultyPreference: preferences.difficulty,
          notifications: {
            email: preferences.notifications.email,
            productUpdates: preferences.notifications.productUpdates ?? true,
            learningReminders: preferences.notifications.learningReminders ?? true,
          },
        };

        const response = await fetch(`${API_BASE_URL}/users/me/preferences`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(backendPrefs),
        });

        if (!response.ok) {
          if (response.status === 401) {
            // If unauthorized, treat as local-only settings but do not show a scary error
            // eslint-disable-next-line no-console
            console.warn('Saving preferences unauthorized (401). Falling back to local-only storage.');
          } else {
            const errorData = await response.json().catch(() => null);
            throw new Error(errorData?.error?.message || 'Failed to save preferences');
          }
        } else {
          const result = await response.json();
          const savedBackendPrefs = result.data as BackendPreferences;

          // Convert back to frontend format
          const savedFrontendPrefs: FrontendPreferences = {
            ...preferences,
            theme: savedBackendPrefs.theme,
            learningPace: savedBackendPrefs.learningPace === 'normal' ? 'medium' : savedBackendPrefs.learningPace,
            difficulty: savedBackendPrefs.difficultyPreference,
            notifications: {
              ...preferences.notifications,
              email: savedBackendPrefs.notifications.email,
              productUpdates: savedBackendPrefs.notifications.productUpdates,
              learningReminders: savedBackendPrefs.notifications.learningReminders,
            },
          };

          setPreferences(savedFrontendPrefs);
          setInitialPreferences(savedFrontendPrefs);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(savedFrontendPrefs));
        }
      }

      setSuccessMessage('Settings saved successfully!');
      setHasChanges(false);

      // Apply theme immediately
      applyTheme(preferences.theme);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error saving preferences:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to save settings. Please try again.';
      setErrorMessage(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPreferences = () => {
    setPreferences(initialPreferences);
    setHasChanges(false);
    applyTheme(initialPreferences.theme);
  };

  const updatePreference = <K extends keyof FrontendPreferences>(
    key: K,
    value: FrontendPreferences[K]
  ) => {
    setPreferences((prev) => {
      const updated = { ...prev, [key]: value };
      
      // Apply theme immediately when changed
      if (key === 'theme') {
        applyTheme(value as 'light' | 'dark' | 'system');
      }
      
      return updated;
    });
  };

  const updateNotification = (key: keyof FrontendPreferences['notifications'], value: boolean) => {
    setPreferences((prev) => ({
      ...prev,
      notifications: { ...prev.notifications, [key]: value },
    }));
  };

  const updatePrivacySetting = (key: keyof FrontendPreferences['privacySettings'], value: boolean) => {
    setPreferences((prev) => ({
      ...prev,
      privacySettings: { ...prev.privacySettings, [key]: value },
    }));
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-lg bg-white px-6 py-4 shadow">
          <p className="text-sm text-slate-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Main Content */}
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="mt-2 text-gray-600">
            Customize your experience and manage your preferences
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

        {/* Appearance Settings */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Appearance</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Theme
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['light', 'dark', 'system'] as const).map((theme) => (
                <button
                  key={theme}
                  onClick={() => updatePreference('theme', theme)}
                  className={`rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all ${
                    preferences.theme === theme
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {theme === 'light' && '☀️ Light'}
                  {theme === 'dark' && '🌙 Dark'}
                  {theme === 'system' && '💻 System'}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Choose how the interface appears. System will follow your device settings.
            </p>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Notifications</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Email Notifications</p>
                <p className="text-sm text-gray-600">
                  Receive updates about your progress and new features via email
                </p>
              </div>
              <button
                onClick={() => updateNotification('email', !preferences.notifications.email)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  preferences.notifications.email ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    preferences.notifications.email ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">In-App Notifications</p>
                <p className="text-sm text-gray-600">
                  Show notifications within the application
                </p>
              </div>
              <button
                onClick={() => updateNotification('inApp', !preferences.notifications.inApp)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  preferences.notifications.inApp ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    preferences.notifications.inApp ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Learning Preferences */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Learning Preferences</h2>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Learning Pace
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['slow', 'medium', 'fast'] as const).map((pace) => {
                // Map 'medium' to display but use 'normal' for backend
                const displayPace = pace;
                return (
                  <button
                    key={pace}
                    onClick={() => updatePreference('learningPace', pace)}
                    className={`rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all ${
                      preferences.learningPace === pace
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {pace === 'slow' && '🐢 Slow'}
                    {pace === 'medium' && '🚶 Medium'}
                    {pace === 'fast' && '🏃 Fast'}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Adjust how quickly new concepts and challenges are introduced
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Difficulty Level
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['beginner', 'intermediate', 'advanced'] as const).map((difficulty) => (
                <button
                  key={difficulty}
                  onClick={() => updatePreference('difficulty', difficulty)}
                  className={`rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all ${
                    preferences.difficulty === difficulty
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {difficulty === 'beginner' && '🌱 Beginner'}
                  {difficulty === 'intermediate' && '🌿 Intermediate'}
                  {difficulty === 'advanced' && '🌳 Advanced'}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Set your current skill level to receive appropriate challenges
            </p>
          </div>
        </div>

        {/* Privacy Settings */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Privacy</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Share Progress</p>
                <p className="text-sm text-gray-600">
                  Allow others to see your completed scenarios and achievements
                </p>
              </div>
              <button
                onClick={() => updatePrivacySetting('shareProgress', !preferences.privacySettings.shareProgress)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  preferences.privacySettings.shareProgress ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    preferences.privacySettings.shareProgress ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Show in Leaderboard</p>
                <p className="text-sm text-gray-600">
                  Display your name and score on public leaderboards
                </p>
              </div>
              <button
                onClick={() => updatePrivacySetting('showInLeaderboard', !preferences.privacySettings.showInLeaderboard)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  preferences.privacySettings.showInLeaderboard ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    preferences.privacySettings.showInLeaderboard ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Usage Analytics</p>
                <p className="text-sm text-gray-600">
                  Help improve the platform by sharing anonymous usage data
                </p>
              </div>
              <button
                onClick={() => updatePrivacySetting('allowAnalytics', !preferences.privacySettings.allowAnalytics)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  preferences.privacySettings.allowAnalytics ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    preferences.privacySettings.allowAnalytics ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Language Settings */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Language & Region</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Interface Language
            </label>
            <select
              value={preferences.language}
              onChange={(e) => updatePreference('language', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="zh">中文</option>
              <option value="ja">日本語</option>
              <option value="ko">한국어</option>
            </select>
            <p className="mt-2 text-xs text-gray-500">
              Select your preferred language for the interface
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        {hasChanges && (
          <div className="sticky bottom-4 rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">You have unsaved changes</p>
              <div className="flex gap-3">
                <button
                  onClick={handleResetPreferences}
                  className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
                >
                  Reset
                </button>
                <button
                  onClick={handleSavePreferences}
                  disabled={isSaving}
                  className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
