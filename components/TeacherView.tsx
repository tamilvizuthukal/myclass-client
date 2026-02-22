import React, { useState, useCallback, useEffect, useRef } from 'react';
import { CascadeSelectors } from './CascadeSelectors';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileHome } from './MobileHome';
import { ProfilePage } from './ProfilePage';
import { ExitBottomSheet } from './ExitBottomSheet';
import { ResourceType, TeacherState } from '../types';
import { ContentDisplay } from './ContentDisplay';
import { useSession } from '../context/SessionContext';
import { useScrollPersistence } from '../hooks/useScrollPersistence';
import { SelectionRestorationIndicator } from './SelectionRestorationIndicator';
import { AnimatedBackground } from './AnimatedBackground';

export const TeacherView: React.FC = () => {
    const { session, logout, updateTeacherState } = useSession();
    const { user, teacherState: state } = session;

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isProfilePageOpen, setIsProfilePageOpen] = useState(false);
    const [showExitSheet, setShowExitSheet] = useState(false);
    const exitSheetShowing = useRef(false);

    // Check if device is mobile
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Use scroll persistence hook
    const { scrollElementRef, handleScroll } = useScrollPersistence(
        state.scrollPosition,
        (position) => updateTeacherState({ scrollPosition: position }),
        [state.classId, state.subjectId, state.unitId, state.subUnitId, state.lessonId, state.selectedResourceType]
    );

    // Reset scroll position when navigation state changes (but not scroll itself)
    const updateStateAndResetScroll = useCallback((updates: Partial<TeacherState>) => {
        updateTeacherState({ ...updates, scrollPosition: 0 });
    }, [updateTeacherState]);

    const handleClassChange = useCallback((id: string | null) => {
        updateStateAndResetScroll({ classId: id, subjectId: null, unitId: null, subUnitId: null, lessonId: null, selectedResourceType: null });
    }, [updateStateAndResetScroll]);

    const handleSubjectChange = useCallback((id: string | null) => {
        updateStateAndResetScroll({ subjectId: id, unitId: null, subUnitId: null, lessonId: null, selectedResourceType: null });
    }, [updateStateAndResetScroll]);

    const handleUnitChange = useCallback((id: string | null) => {
        updateStateAndResetScroll({ unitId: id, subUnitId: null, lessonId: null, selectedResourceType: null });
    }, [updateStateAndResetScroll]);

    const handleSubUnitChange = useCallback((id: string | null) => {
        updateStateAndResetScroll({ subUnitId: id, lessonId: null, selectedResourceType: null });
    }, [updateStateAndResetScroll]);

    const handleLessonChange = useCallback((id: string | null) => {
        updateStateAndResetScroll({
            lessonId: id,
            selectedResourceType: id ? (isMobile ? null : 'slide') : null
        });
    }, [updateStateAndResetScroll, isMobile]);

    const handleSelectResourceType = useCallback((resourceType: ResourceType) => {
        updateStateAndResetScroll({ selectedResourceType: resourceType });
        if (isMobile) {
            setSidebarOpen(false);
        }
    }, [updateStateAndResetScroll, isMobile]);

    const handleProfile = useCallback(() => {
        setIsProfilePageOpen(!isProfilePageOpen);
    }, [isProfilePageOpen]);

    const handleBackToGrid = useCallback(() => {
        updateTeacherState({
            selectedResourceType: null,
            scrollPosition: 0
        });
        setIsProfilePageOpen(false);
    }, [updateTeacherState]);

    const isPopping = useRef(false);

    const handleGoBack = useCallback(() => {
        if (isProfilePageOpen) {
            setIsProfilePageOpen(false);
            return;
        }

        isPopping.current = true;
        if (state.selectedResourceType) {
            updateTeacherState({ selectedResourceType: null });
        } else if (state.lessonId) {
            updateTeacherState({ lessonId: null });
        } else if (state.subUnitId) {
            updateTeacherState({ subUnitId: null });
        } else if (state.unitId) {
            updateTeacherState({ unitId: null });
        } else if (state.subjectId) {
            updateTeacherState({ subjectId: null });
        } else if (state.classId) {
            updateTeacherState({ classId: null });
        } else {
            // We are on the home page with nothing selected
            isPopping.current = false;
            if (exitSheetShowing.current) {
                // Second tap while sheet is visible → close the browser/app
                window.close();
                // Fallback for browsers that block window.close()
                window.location.href = 'about:blank';
            } else {
                exitSheetShowing.current = true;
                setShowExitSheet(true);
            }
        }
    }, [isProfilePageOpen, state, updateTeacherState]);

    // Handle browser/mobile back button
    useEffect(() => {
        const handlePopState = (e: PopStateEvent) => {
            // No need to prevent default for popstate, but we handle it
            handleGoBack();
        };

        window.addEventListener('popstate', handlePopState);

        // Push an initial state so we have something to pop
        if (window.history.state === null) {
            window.history.replaceState({ path: 'home' }, '');
        }

        return () => window.removeEventListener('popstate', handlePopState);
    }, [handleGoBack]);

    // Push to history when navigation state changes to enable the back button
    useEffect(() => {
        if (isPopping.current) {
            isPopping.current = false;
            return;
        }

        const hasSelection = state.classId || state.subjectId || state.unitId || state.subUnitId || state.lessonId || state.selectedResourceType || isProfilePageOpen;
        if (hasSelection) {
            // We push a dummy state so the next back button press triggers popstate
            window.history.pushState({ nav: Date.now() }, '');
        }
    }, [state.classId, state.subjectId, state.unitId, state.subUnitId, state.lessonId, state.selectedResourceType, isProfilePageOpen]);

    if (!user) {
        return null; // Safeguard
    }

    // Only show back button if we are "inside" something (resource view or profile)
    const showBackButton = !!(state.selectedResourceType || isProfilePageOpen);

    const handleExitSheetDismiss = useCallback(() => {
        exitSheetShowing.current = false;
        setShowExitSheet(false);
    }, []);

    return (
        <div className="flex flex-col h-screen overflow-hidden relative">
            <AnimatedBackground />
            <ExitBottomSheet visible={showExitSheet} onDismiss={handleExitSheetDismiss} />
            <Header
                user={user}
                onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                onLogout={logout}
                onProfile={handleProfile}
                onBack={isMobile && showBackButton ? handleBackToGrid : undefined}
                isMobile={isMobile}
            />
            <SelectionRestorationIndicator />
            <div className="flex flex-1 overflow-hidden">
                <Sidebar
                    lessonId={state.lessonId}
                    selectedResourceType={state.selectedResourceType}
                    onSelectResourceType={handleSelectResourceType}
                    isOpen={isMobile ? false : sidebarOpen}
                    isMobile={isMobile}
                />
                <main
                    ref={scrollElementRef}
                    onScroll={handleScroll}
                    className="flex-1 flex flex-col bg-gray-100/50 dark:bg-gray-800/50 backdrop-blur-3xl overflow-y-auto relative transition-all duration-300 border-l border-gray-200 dark:border-gray-700 h-full">
                    {isProfilePageOpen ? (
                        <div className="h-full overflow-y-auto">
                            <ProfilePage
                                user={user}
                                onBack={() => setIsProfilePageOpen(false)}
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col h-full bg-white/40 dark:bg-gray-900/40">
                            {isMobile && !state.selectedResourceType ? (
                                <MobileHome
                                    onSelectResourceType={handleSelectResourceType}
                                    currentResourceType={state.selectedResourceType}
                                    classId={state.classId}
                                    subjectId={state.subjectId}
                                    unitId={state.unitId}
                                    subUnitId={state.subUnitId}
                                    lessonId={state.lessonId}
                                    onClassChange={handleClassChange}
                                    onSubjectChange={handleSubjectChange}
                                    onUnitChange={handleUnitChange}
                                    onSubUnitChange={handleSubUnitChange}
                                    onLessonChange={handleLessonChange}
                                    userRole={user?.role}
                                    userClass={user?.class}
                                    userName={user?.name}
                                />
                            ) : (
                                <>
                                    {!isMobile && (
                                        <div className="shrink-0">
                                            <CascadeSelectors
                                                classId={state.classId}
                                                subjectId={state.subjectId}
                                                unitId={state.unitId}
                                                subUnitId={state.subUnitId}
                                                lessonId={state.lessonId}
                                                onClassChange={handleClassChange}
                                                onSubjectChange={handleSubjectChange}
                                                onUnitChange={handleUnitChange}
                                                onSubUnitChange={handleSubUnitChange}
                                                onLessonChange={handleLessonChange}
                                                lockedClassName={user?.role === 'student' ? user?.class : undefined}
                                            />
                                        </div>
                                    )}
                                    <div className="flex-1 overflow-hidden">
                                        <ContentDisplay
                                            lessonId={state.lessonId}
                                            selectedResourceType={state.selectedResourceType}
                                            user={user}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};