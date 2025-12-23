import React, { useState, useEffect } from 'react';

export const InstallPWABanner: React.FC = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handleBeforeInstallPrompt = (e: any) => {
            // Prevent browser's default banner
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
            // Show the banner
            setIsVisible(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        // Show the install prompt
        deferredPrompt.prompt();
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        // We've used the prompt, and can't use it again, throw it away
        setDeferredPrompt(null);
        setIsVisible(false);
    };

    const handleDismiss = () => {
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] md:hidden transition-all duration-300 ease-in-out transform translate-y-0">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <img src="/logo.png" alt="App Icon" className="w-12 h-12 rounded-xl shadow-sm flex-shrink-0" />
                    <div className="min-w-0">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">Tamil Vizuthukal</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Add to Home Screen</p>
                    </div>
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0">
                    <button
                        onClick={handleDismiss}
                        className="px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700/50 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                        Later
                    </button>
                    <button
                        onClick={handleInstallClick}
                        className="px-3 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors"
                    >
                        Install
                    </button>
                </div>
            </div>
        </div>
    );
};
