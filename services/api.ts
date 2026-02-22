import { Class, Subject, Unit, SubUnit, Lesson, ResourceType, GroupedContent, ResourceCounts, User } from '../types';

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
        throw new Error(errorData.message || `API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
};

// --- Auth ---
export const loginUser = (username: string, password: string): Promise<{ user: User, token: string }> =>
    apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });

export const signupUser = (data: { username: string; password: string; name: string; email: string; mobileNumber?: string; role?: string; class?: string; schoolName?: string; district?: string; subDistrict?: string }): Promise<{ user: User, token: string }> =>
    apiRequest('/auth/signup', { method: 'POST', body: JSON.stringify(data) });

// --- Hierarchy ---
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

export const getClasses = async (): Promise<Class[]> => {
    return apiRequest<Class[]>('/classes');
};

export const getSubjectsByClassId = (classId: string): Promise<Subject[]> =>
    apiRequest(`/subjects${buildQuery({ classId })}`);

export const getUnitsBySubjectId = (subjectId: string): Promise<Unit[]> =>
    apiRequest(`/units${buildQuery({ subjectId })}`);

export const getSubUnitsByUnitId = (unitId: string): Promise<SubUnit[]> =>
    apiRequest(`/subUnits${buildQuery({ unitId })}`);

export const getLessonsBySubUnitId = (subUnitId: string): Promise<Lesson[]> =>
    apiRequest(`/lessons${buildQuery({ subUnitId })}`);

export const getHierarchy = (lessonId: string): Promise<{
    className: string;
    subjectName: string;
    unitName: string;
    subUnitName: string;
    lessonName: string;
    isPublished?: boolean;
    qaDownloadCount?: number;
}> => apiRequest(`/hierarchy/${lessonId}`);

// --- Content ---
export const getContentsByLessonId = (lessonId: string, types?: ResourceType[], publishedOnly?: boolean): Promise<GroupedContent[]> => {
    const params: Record<string, string | boolean> = { lessonId };
    if (types && types.length > 0) params.type = types[0];
    if (publishedOnly !== undefined) params.publishedOnly = publishedOnly;
    return apiRequest(`/content${buildQuery(params)}`);
};

export const downloadContent = (id: string, userId: string, email: string): Promise<{ success: boolean; message: string; fileUrl?: string; isAdmin?: boolean; emailSent?: boolean; adminPhone?: string }> =>
    apiRequest(`/content/${id}/download`, { method: 'POST', body: JSON.stringify({ userId, email }) });

export const getCountsByLessonId = async (lessonId: string): Promise<ResourceCounts> => {
    const grouped: GroupedContent[] = await getContentsByLessonId(lessonId);
    const counts: ResourceCounts = {};
    grouped.forEach(g => {
        counts[g.type] = g.count;
    });
    return counts;
};

// --- Profile & Access ---
export const getUserProfile = (id: string): Promise<{ success: boolean; user: User }> =>
    apiRequest(`/users/${id}/profile`);

export const updateUserProfile = (id: string, data: { name: string; email: string; mobileNumber?: string; class?: string; schoolName?: string; district?: string; subDistrict?: string }): Promise<{ success: boolean; user: User; message: string }> =>
    apiRequest(`/users/${id}/update-profile`, { method: 'PUT', body: JSON.stringify(data) });

export const changePassword = (id: string, data: { currentPassword: string; newPassword: string; confirmPassword: string }): Promise<{ success: boolean; message: string }> =>
    apiRequest(`/users/${id}/change-password`, { method: 'PUT', body: JSON.stringify(data) });

export const updateProfile = (id: string, data: { password: string; mobileNumber: string }): Promise<User> =>
    apiRequest(`/users/${id}/profile`, { method: 'PUT', body: JSON.stringify(data) });

export const requestTeacherAccess = (id: string): Promise<{ success: boolean; message: string }> =>
    apiRequest(`/users/${id}/request-teacher`, { method: 'POST' });

// --- View Tracking ---
export const trackView = (lessonId: string, type: string): Promise<{ success: boolean }> =>
    apiRequest(`/lessons/${lessonId}/view`, { method: 'POST', body: JSON.stringify({ type }) });

export const trackContentView = (contentId: string): Promise<{ success: boolean; viewCount: number }> =>
    apiRequest(`/content/${contentId}/view`, { method: 'POST' });