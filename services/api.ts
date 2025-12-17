import { Class, Subject, Unit, SubUnit, Lesson, Content, ResourceType, GroupedContent, ResourceCounts, User } from '../types';

const API_BASE = ((import.meta as any).env && (import.meta as any).env.VITE_API_URL ? (import.meta as any).env.VITE_API_URL : '') + '/api';

// Helper for fetch requests
const apiRequest = async <T>(endpoint: string, options?: RequestInit): Promise<T> => {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
            'Content-Type': 'application/json',
        },
        ...options,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API Error: ${response.statusText}`);
    }

    return response.json();
};

// ============================================================================
// USER-FACING API FUNCTIONS ONLY
// Admin functions removed to match consolidated backend
// ============================================================================

// --- Auth ---
export const loginUser = (username: string, password: string): Promise<{ user: User, token: string }> =>
    apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });

// --- Hierarchy (Read-Only, Published Content Only) ---
export const getClasses = (): Promise<Class[]> => apiRequest('/classes');

export const getSubjectsByClassId = (classId: string): Promise<Subject[]> =>
    apiRequest(`/subjects?classId=${classId}`);

export const getUnitsBySubjectId = (subjectId: string): Promise<Unit[]> =>
    apiRequest(`/units?subjectId=${subjectId}`);

export const getSubUnitsByUnitId = (unitId: string): Promise<SubUnit[]> =>
    apiRequest(`/subUnits?unitId=${unitId}`);

export const getLessonsBySubUnitId = (subUnitId: string): Promise<Lesson[]> =>
    apiRequest(`/lessons?subUnitId=${subUnitId}`);

export const getHierarchy = (lessonId: string): Promise<{
    className: string;
    subjectName: string;
    unitName: string;
    subUnitName: string;
    lessonName: string;
    isPublished?: boolean;
}> => apiRequest(`/hierarchy/${lessonId}`);

// --- Content (Read-Only, Published Content Only) ---
export const getContentsByLessonId = (lessonId: string, types?: ResourceType[]): Promise<GroupedContent[]> => {
    let url = `/content?lessonId=${lessonId}`;
    console.log('[API] getContentsByLessonId called:', { lessonId, types, url });

    if (types && types.length > 0) {
        url += `&type=${types[0]}`;
        console.log('[API] getContentsByLessonId with type filter:', url);
    }

    return apiRequest(url);
};

export const getCountsByLessonId = async (lessonId: string): Promise<ResourceCounts> => {
    const grouped: GroupedContent[] = await getContentsByLessonId(lessonId);
    const counts: ResourceCounts = {};
    grouped.forEach(g => {
        counts[g.type] = g.count;
    });
    return counts;
};

// --- User Profile Management ---
export const getUserProfile = (id: string): Promise<{ success: boolean; user: User }> =>
    apiRequest(`/users/${id}/profile`);

export const updateUserProfile = (id: string, data: { name: string; email: string; mobileNumber?: string }): Promise<{ success: boolean; user: User; message: string }> =>
    apiRequest(`/users/${id}/update-profile`, { method: 'PUT', body: JSON.stringify(data) });

export const changePassword = (id: string, data: { currentPassword: string; newPassword: string; confirmPassword: string }): Promise<{ success: boolean; message: string }> =>
    apiRequest(`/users/${id}/change-password`, { method: 'PUT', body: JSON.stringify(data) });

export const updateProfile = (id: string, data: { password: string; mobileNumber: string }): Promise<User> =>
    apiRequest(`/users/${id}/profile`, { method: 'PUT', body: JSON.stringify(data) });

// --- Helper Functions ---
export const getBreadcrumbs = async (lessonId: string): Promise<string> => {
    // Placeholder - returns empty string
    return "";
};