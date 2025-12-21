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
        if (response.status === 404) {
            console.warn(`[API] Resource not found: ${endpoint}`);
        } else {
            console.error(`[API Error] ${endpoint}:`, response.status, response.statusText, errorData);
        }
        throw new Error(errorData.message || `API Error: ${response.status} ${response.statusText}`);
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

// --- Hierarchy (Read-Only, Published Content Only by default) ---
const buildQuery = (params: Record<string, string | boolean | undefined>) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
            searchParams.append(key, String(value));
        }
    });
    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : '';
};

export const getClasses = async (onlyPublished: boolean = true): Promise<Class[]> => {
    console.log('[API] getClasses called', { onlyPublished });
    const result = await apiRequest<Class[]>(`/classes${!onlyPublished ? '?includeUnpublished=true' : ''}`);
    console.log('[API] getClasses result:', result?.length || 0, 'classes');
    return result;
};

export const getSubjectsByClassId = (classId: string, onlyPublished: boolean = true): Promise<Subject[]> =>
    apiRequest(`/subjects${buildQuery({ classId, includeUnpublished: !onlyPublished ? 'true' : undefined })}`);

export const getUnitsBySubjectId = (subjectId: string, onlyPublished: boolean = true): Promise<Unit[]> =>
    apiRequest(`/units${buildQuery({ subjectId, includeUnpublished: !onlyPublished ? 'true' : undefined })}`);

export const getSubUnitsByUnitId = (unitId: string, onlyPublished: boolean = true): Promise<SubUnit[]> =>
    apiRequest(`/subUnits${buildQuery({ unitId, includeUnpublished: !onlyPublished ? 'true' : undefined })}`);

export const getLessonsBySubUnitId = (subUnitId: string, onlyPublished: boolean = true): Promise<Lesson[]> =>
    apiRequest(`/lessons${buildQuery({ subUnitId, includeUnpublished: !onlyPublished ? 'true' : undefined })}`);

export const getHierarchy = (lessonId: string): Promise<{
    className: string;
    subjectName: string;
    unitName: string;
    subUnitName: string;
    lessonName: string;
    isPublished?: boolean;
}> => apiRequest(`/hierarchy/${lessonId}`);

// --- Content (Read-Only, Published Content Only by default) ---
export const getContentsByLessonId = (lessonId: string, types?: ResourceType[], onlyPublished: boolean = true): Promise<GroupedContent[]> => {
    const params: Record<string, string> = { lessonId };
    if (!onlyPublished) params.includeUnpublished = 'true';
    if (types && types.length > 0) params.type = types[0];

    let url = `/content${buildQuery(params)}`;
    console.log('[API] getContentsByLessonId called:', { lessonId, types, url });

    return apiRequest(url);
};

export const getCountsByLessonId = async (lessonId: string): Promise<ResourceCounts> => {
    const grouped: GroupedContent[] = await getContentsByLessonId(lessonId, undefined, true); // counts usually for display, so published only
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