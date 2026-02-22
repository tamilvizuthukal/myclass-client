import React, { useEffect } from 'react';

interface ExitBottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export const ExitBottomSheet: React.FC<ExitBottomSheetProps> = ({ isOpen, onClose, onConfirm }) => {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />

            {/* Sheet */}
            <div className={`
                relative w-full max-w-md bg-white dark:bg-gray-900 rounded-t-[32px] sm:rounded-[32px] 
                shadow-2xl border-t border-gray-100 dark:border-gray-800 p-6 pb-10 sm:pb-6
                animate-slide-up-mobile sm:animate-bounce-in
            `}>
                {/* Drag Handle (Mobile) */}
                <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-6 sm:hidden" />

                <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4 ring-8 ring-red-50/50 dark:ring-red-900/10">
                        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>

                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 font-tau-marutham">
                        வெளியேறவா?
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-8 font-tau-paalai text-[14px]">
                        செயலியை விட்டு வெளியேற விரும்புகிறீர்களா? <br />
                        மீண்டும் ஒருமுறை அழுத்தவும்.
                    </p>

                    <div className="grid grid-cols-2 gap-4 w-full">
                        <button
                            onClick={onClose}
                            className="flex items-center justify-center gap-2 py-4 px-6 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold transition-all active:scale-95 font-tau-paalai text-[14px]"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            இல்லை
                        </button>
                        <button
                            onClick={onConfirm}
                            className="flex items-center justify-center gap-2 py-4 px-6 rounded-2xl bg-red-500 text-white font-bold shadow-lg shadow-red-500/30 transition-all active:scale-95 font-tau-paalai text-[14px]"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            வெளியேறு
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes slideUpMobile {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                .animate-slide-up-mobile {
                    animation: slideUpMobile 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fade-in {
                    animation: fadeIn 0.3s ease-out;
                }
            `}</style>
        </div>
    );
};
