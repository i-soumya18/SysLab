import React from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useFirebaseAuthContext } from '../hooks/useFirebaseAuth';
import { useAdmin } from '../hooks/useAdmin';

interface AppShellProps {
  children: React.ReactNode;
  variant?: 'default' | 'marketing';
}

const getInitials = (name: string | null): string => {
  if (!name) {
    return 'U';
  }

  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export const AppShell: React.FC<AppShellProps> = ({ children, variant = 'default' }) => {
  const { user, logoutUser } = useFirebaseAuthContext();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();

  const isAuthenticated = Boolean(user);
  const isMarketing = variant === 'marketing';
  const brandTarget = isAuthenticated ? '/dashboard' : '/';

  const handleLogout = async (): Promise<void> => {
    try {
      await logoutUser();
      navigate('/');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error logging out:', error);
    }
  };

  const navLinkBaseClasses =
    'text-sm font-medium px-3 py-2 rounded-md transition-colors';
  const navLinkInactiveClasses = isMarketing
    ? 'text-white/80 hover:text-white hover:bg-white/10'
    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100';
  const navLinkActiveClasses = isMarketing
    ? 'text-white bg-white/10'
    : 'text-blue-700 bg-blue-50';

  const containerClasses = isMarketing
    ? 'min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900'
    : 'min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-blue-50';

  const navbarClasses = isMarketing
    ? 'border-b border-white/10 bg-white/5 backdrop-blur-sm'
    : 'border-b border-gray-200 bg-white shadow-sm';

  const footerClasses = isMarketing
    ? 'border-t border-white/10 bg-white/5'
    : 'border-t border-gray-200 bg-white';

  const commonNavItems = [
    { to: '/components', label: 'Components', requiresAuth: false },
    { to: '/pricing', label: 'Pricing', requiresAuth: false },
    { to: '/about', label: 'About', requiresAuth: false }
  ];

  const authenticatedItems = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/workspace', label: 'Workspace' },
    { to: '/getting-started', label: 'Getting Started' }
  ];

  return (
    <div className={containerClasses}>
      <nav className={navbarClasses}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <button
              type="button"
              onClick={() => navigate(brandTarget)}
              className={
                isMarketing
                  ? 'text-2xl font-bold text-white'
                  : 'text-2xl font-bold text-blue-600'
              }
            >
              System Design Simulator
            </button>

            <div className="hidden items-center gap-1 md:flex">
              {isAuthenticated &&
                authenticatedItems.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      [
                        navLinkBaseClasses,
                        isActive ? navLinkActiveClasses : navLinkInactiveClasses
                      ].join(' ')
                    }
                    end={item.to === '/dashboard'}
                  >
                    {item.label}
                  </NavLink>
                ))}

              {commonNavItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    [
                      navLinkBaseClasses,
                      isActive ? navLinkActiveClasses : navLinkInactiveClasses
                    ].join(' ')
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {!isAuthenticated && (
              <button
                type="button"
                onClick={() =>
                  navigate(
                    location.pathname === '/'
                      ? '/dashboard'
                      : '/dashboard'
                  )
                }
                className={
                  isMarketing
                    ? 'rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700'
                    : 'rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700'
                }
              >
                Get Started
              </button>
            )}

            {isAuthenticated && (
              <div className="relative group">
                <button
                  type="button"
                  className={
                    isMarketing
                      ? 'flex items-center space-x-2 rounded-lg px-3 py-2 hover:bg-white/10'
                      : 'flex items-center space-x-2 rounded-lg px-3 py-2 hover:bg-gray-100'
                  }
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-medium text-white">
                    {getInitials(user?.displayName || user?.email || '')}
                  </div>
                  <span
                    className={
                      isMarketing
                        ? 'text-sm font-medium text-white'
                        : 'text-sm font-medium text-gray-700'
                    }
                  >
                    {user?.displayName || user?.email?.split('@')[0] || 'User'}
                  </span>
                </button>

                <div className="invisible absolute right-0 z-40 mt-2 w-48 origin-top-right rounded-lg bg-white text-gray-900 shadow-lg ring-1 ring-black ring-opacity-5 opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100">
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => navigate('/profile')}
                      className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/settings')}
                      className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Settings
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/subscription')}
                      className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Subscription
                    </button>
                    {isAdmin && (
                      <>
                        <hr className="my-1" />
                        <button
                          type="button"
                          onClick={() => navigate('/admin')}
                          className="block w-full px-4 py-2 text-left text-sm text-purple-600 hover:bg-purple-50"
                        >
                          Admin Panel
                        </button>
                      </>
                    )}
                    <hr className="my-1" />
                    <button
                      type="button"
                      onClick={() => {
                        void handleLogout();
                      }}
                      className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="flex-1">
        {children}
      </main>

      <footer className={`${footerClasses} py-6`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 text-sm sm:px-6 lg:px-8">
          <div
            className={
              isMarketing ? 'text-white/70' : 'text-gray-500'
            }
          >
            © 2026 System Design Simulator. Built for learning.
          </div>
          <div className="flex items-center gap-6">
            <Link
              to="/pricing"
              className={
                isMarketing
                  ? 'text-white/70 hover:text-white'
                  : 'text-gray-500 hover:text-gray-800'
              }
            >
              Pricing
            </Link>
            <Link
              to="/about"
              className={
                isMarketing
                  ? 'text-white/70 hover:text-white'
                  : 'text-gray-500 hover:text-gray-800'
              }
            >
              About
            </Link>
            <Link
              to="/components"
              className={
                isMarketing
                  ? 'text-white/70 hover:text-white'
                  : 'text-gray-500 hover:text-gray-800'
              }
            >
              Docs
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AppShell;

