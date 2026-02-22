import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { FullScreenIcon, ExitFullScreenIcon, LogoutIcon, UsersIcon } from './icons/AdminIcons';

interface HeaderProps {
  user: User;
  onToggleSidebar: () => void;
  onLogout: () => void;
  selectedClass?: string;
  onClassSelect?: () => void;
  onProfile?: () => void;
  onBack?: () => void;
  isMobile?: boolean;
}

const MenuIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
);

const SunIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
);

const MoonIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
);

export const Header: React.FC<HeaderProps> = ({ user, onToggleSidebar, onLogout, selectedClass, onProfile, onBack, isMobile }) => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.theme === 'dark' ||
        (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setIsDropdownOpen(false);
  };

  useEffect(() => {
    const themeColor = isDarkMode ? '#111827' : '#ffffff';
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => { });
    } else {
      document.exitFullscreen?.();
    }
  };

  useEffect(() => {
    const onFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullScreenChange);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [isTamilTitle, setIsTamilTitle] = useState(true);
  const [animState, setAnimState] = useState<'visible' | 'out' | 'in-start'>('visible');

  useEffect(() => {
    const cycleTime = 10000;
    const interval = setInterval(() => {
      setAnimState('out');
      setTimeout(() => {
        setIsTamilTitle(prev => !prev);
        setAnimState('in-start');
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setAnimState('visible');
          });
        });
      }, 500);
    }, cycleTime);
    return () => clearInterval(interval);
  }, []);

  const getTransformClass = () => {
    switch (animState) {
      case 'visible': return 'translate-y-0 opacity-100 transition-all duration-500 ease-out';
      case 'out': return '-translate-y-8 opacity-0 transition-all duration-500 ease-in';
      case 'in-start': return 'translate-y-8 opacity-0 transition-none duration-0';
      default: return 'translate-y-0 opacity-100';
    }
  };

  return (
    <header className="flex items-center justify-between px-2 sm:px-4 h-12 bg-white/70 dark:bg-gray-900/70 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 z-30 shrink-0">
      <div className="flex items-center space-x-2 sm:space-x-4">
        {onBack ? (
          <button
            onClick={onBack}
            className="group relative h-8 p-[2px] rounded-xl overflow-hidden transition-all active:scale-95 flex items-center justify-center shrink-0 ml-1 shadow-md"
          >
            <div className="absolute inset-[-500%] bg-[conic-gradient(from_0deg,#3b82f6_0%,#8b5cf6_25%,#ec4899_50%,#8b5cf6_75%,#3b82f6_100%)] animate-[spin_4s_linear_infinite]" />
            <div className="relative flex items-center justify-center gap-1.5 px-3 bg-white dark:bg-gray-900 rounded-[10px] h-full w-full">
              <svg className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-[14px] font-bold text-gray-700 dark:text-gray-200 font-sans tracking-wide whitespace-nowrap">Back</span>
            </div>
          </button>
        ) : (
          <button
            onClick={onToggleSidebar}
            className={`${isMobile ? 'hidden' : 'block'} p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500`}
            aria-label="Toggle resource sidebar"
          >
            <MenuIcon className="h-5 w-5 sm:h-6 sm:w-6 text-gray-600 dark:text-gray-300" />
          </button>
        )}

        <div className="flex items-center space-x-3 overflow-hidden h-10">
          <h1
            className={`text-lg sm:text-2xl font-bold truncate bg-clip-text text-transparent pl-1 transform block
              bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400
              ${isTamilTitle ? 'font-tau-kabilar' : 'font-sans'}
              ${getTransformClass()}
              `}
          >
            {isTamilTitle ? 'தமிழ் விழுதுகள்' : 'Tamil Vizuthukal'}
          </h1>
        </div>
      </div>
      <div className="flex items-center space-x-1 sm:space-x-2">
        <button
          onClick={toggleFullScreen}
          className="hidden md:flex w-8 h-8 sm:w-7 sm:h-7 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-150 items-center justify-center overflow-hidden"
          title={isFullScreen ? "Exit Full Screen" : "Enter Full Screen"}
        >
          {isFullScreen ? (
            <ExitFullScreenIcon className="h-6 w-6 sm:h-5 sm:w-5 text-gray-600 dark:text-gray-300" />
          ) : (
            <FullScreenIcon className="h-6 w-6 sm:h-5 sm:w-5 text-gray-600 dark:text-gray-300" />
          )}
        </button>

        <div className="relative" ref={dropdownRef}>
          {isDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-md shadow-lg py-1 z-50 border border-gray-200 dark:border-gray-700 transform origin-top-right">
              <button
                onClick={() => {
                  onProfile?.();
                  setIsDropdownOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-3 transition-colors duration-150"
              >
                <UsersIcon className="h-4 w-4" />
                <span>Profile</span>
              </button>

              <hr className="border-gray-200 dark:border-gray-600 my-1" />
              <button
                onClick={() => {
                  toggleDarkMode();
                  setIsDropdownOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-3 transition-colors duration-150"
              >
                {isDarkMode ? (
                  <SunIcon className="h-4 w-4" />
                ) : (
                  <MoonIcon className="h-4 w-4" />
                )}
                <span>Toggle Dark Mode</span>
              </button>

              <hr className="border-gray-200 dark:border-gray-600 my-1" />
              <button
                onClick={() => {
                  onLogout();
                  setIsDropdownOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-3 transition-colors duration-150"
              >
                <LogoutIcon className="h-4 w-4" />
                <span>Logout</span>
              </button>

              {deferredPrompt && (
                <>
                  <hr className="border-gray-200 dark:border-gray-600 my-1" />
                  <button
                    onClick={handleInstallClick}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-3 transition-colors duration-150"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Install App</span>
                  </button>
                </>
              )}
            </div>
          )}

          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-8 h-8 sm:w-7 sm:h-7 bg-blue-500 rounded-full user-avatar text-white font-semibold hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-150 mobile-user-icon flex items-center justify-center overflow-hidden"
            aria-label="User menu"
            aria-expanded={isDropdownOpen}
            aria-haspopup="true"
          >
            <span className="text-sm sm:text-xs font-medium leading-none select-none">
              {user.name?.[0]}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};