import React, { useState, useCallback, useEffect } from 'react';
import { CascadeSelectors } from './CascadeSelectors';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileHome } from './MobileHome';
import { ProfilePage } from './ProfilePage';
import { ResourceType, TeacherState } from '../types';
import { ContentDisplay } from './ContentDisplay';
import { useSession } from '../context/SessionContext';
import { useScrollPersistence } from '../hooks/useScrollPersistence';
import { SelectionRestorationIndicator } from './SelectionRestorationIndicator';

export const TeacherView: React.FC = () => {
    const { session, logout, updateTeacherState } = useSession();
    const { user, teacherState: state } = session;

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isProfilePageOpen, setIsProfilePageOpen] = useState(false);

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
        updateTeacherState({ selectedResourceType: null });
    }, [updateTeacherState]);

    if (!user) {
        return null; // Safeguard
    }

    return (
        <div className="flex flex-col h-screen overflow-hidden">
            <Header
                user={user}
                onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                onLogout={logout}
                onProfile={handleProfile}
                onBack={isMobile && state.selectedResourceType ? handleBackToGrid : undefined}
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
                    className="flex-1 flex flex-col bg-gray-100 dark:bg-gray-800 overflow-y-auto relative transition-all duration-300 border-l border-gray-200 dark:border-gray-700 h-full">
                    {isProfilePageOpen ? (
                        <div className="h-full overflow-y-auto">
                            <ProfilePage
                                user={user}
                                onBack={() => setIsProfilePageOpen(false)}
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col h-full bg-white dark:bg-gray-900">
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