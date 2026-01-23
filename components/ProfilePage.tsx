import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { updateUserProfile, changePassword, requestTeacherAccess } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useSession } from '../context/SessionContext';

// Kerala Districts and their Sub-districts (Taluks)
const KERALA_LOCATIONS: { [key: string]: string[] } = {
    "Thiruvananthapuram": ["Neyyattinkara", "Kattakada", "Nedumangad", "Thiruvananthapuram", "Chirayinkeezhu", "Varkala"],
    "Kollam": ["Kollam", "Karunagappally", "Kunnathur", "Kottarakkara", "Punalur", "Pathanapuram"],
    "Pathanamthitta": ["Thiruvalla", "Mallappally", "Ranni", "Kozhencherry", "Konni", "Adoor"],
    "Alappuzha": ["Cherthala", "Ambalapuzha", "Kuttanad", "Karthikappally", "Chengannur", "Mavelikkara"],
    "Kottayam": ["Meenachil", "Vaikom", "Kottayam", "Changanassery", "Kanjirappally"],
    "Idukki": ["Devikulam", "Udumbanchola", "Thodupuzha", "Peerumade", "Idukki"],
    "Ernakulam": ["Paravur", "Aluva", "Kunnathunad", "Muvattupuzha", "Kothamangalam", "Kanayannur", "Kochi"],
    "Thrissur": ["Thrissur", "Mukundapuram", "Kodungallur", "Chavakkad", "Thalapilly", "Chalakudy", "Kunnamkulam"],
    "Palakkad": ["Alathur", "Chittur", "Palakkad", "Pattambi", "Ottapalam", "Mannarkkad"],
    "Malappuram": ["Ernad", "Tirur", "Tirurangadi", "Ponnani", "Perinthalmanna", "Nilambur", "Kondotty"],
    "Kozhikode": ["Kozhikode", "Thamarassery", "Koyilandy", "Vatakara"],
    "Wayanad": ["Mananthavady", "Sulthan Bathery", "Vythiri"],
    "Kannur": ["Taliparamba", "Kannur", "Thalassery", "Iritty", "Payyanur"],
    "Kasaragod": ["Kasaragod", "Hosdurg", "Vellarikundu", "Manjeshwaram"]
};

interface ProfilePageProps {
    user: User;
    onBack: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ user, onBack }) => {
    const { updateProfile } = useSession();
    const [isEditing, setIsEditing] = useState(false);
    const [showPasswordChange, setShowPasswordChange] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { showToast } = useToast();

    const [formData, setFormData] = useState({
        name: user.name || '',
        email: user.email || '',
        role: user.role,
        mobileNumber: (user as any).mobileNumber || '',
        class: (user as any).class || '',
        schoolName: (user as any).schoolName || '',
        district: (user as any).district || '',
        subDistrict: (user as any).subDistrict || ''
    });

    // Effect: Update form data if user object changes (e.g., loaded from API)
    useEffect(() => {
        setFormData({
            name: user.name || '',
            email: user.email || '',
            role: user.role,
            mobileNumber: (user as any).mobileNumber || '',
            class: (user as any).class || '',
            schoolName: (user as any).schoolName || '',
            district: (user as any).district || '',
            subDistrict: (user as any).subDistrict || ''
        });
    }, [user]);

    // Derived state for sub-districts based on selected district
    const [availableSubDistricts, setAvailableSubDistricts] = useState<string[]>([]);
    const classOptions = Array.from({ length: 12 }, (_, i) => `Class ${i + 1}`);

    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });

    const [isTeacherRequested, setIsTeacherRequested] = useState(false);

    // Update available sub-districts when district changes
    useEffect(() => {
        if (formData.district && KERALA_LOCATIONS[formData.district]) {
            setAvailableSubDistricts(KERALA_LOCATIONS[formData.district]);
        } else {
            setAvailableSubDistricts([]);
        }
    }, [formData.district]);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;

        // If district changes, reset subDistrict
        if (name === 'district') {
            setFormData({
                ...formData,
                district: value,
                subDistrict: '' // Reset sub-district
            });
        } else {
            setFormData({
                ...formData,
                [name]: value,
            });
        }
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPasswordData({
            ...passwordData,
            [e.target.name]: e.target.value,
        });
    };

    const handleSaveProfile = async () => {
        setIsLoading(true);
        try {
            // 1. Update Profile Data
            const response = await updateUserProfile(user._id, {
                name: formData.name,
                email: formData.email,
                mobileNumber: formData.mobileNumber,
                class: formData.class,
                schoolName: formData.schoolName,
                district: formData.district,
                subDistrict: formData.subDistrict
            });

            if (response.success && response.user) {
                let updatedUser = response.user;

                // 2. Handle Teacher Request if checked
                if (isTeacherRequested && user.role === 'student' && user.teacherRequestStatus !== 'pending') {
                    try {
                        await requestTeacherAccess(user._id);
                        updatedUser = { ...updatedUser, teacherRequestStatus: 'pending' };
                        showToast('Profile updated and Teacher Access requested!', 'success');
                    } catch (reqError) {
                        console.error('Teacher request failed:', reqError);
                        showToast('Profile updated, but failed to request teacher access.', 'warning');
                    }
                } else {
                    showToast('Profile updated successfully!', 'success');
                }

                updateProfile(updatedUser);
                setIsEditing(false);
            } else {
                showToast(response.message || 'Failed to update profile.', 'error');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            showToast('Failed to update profile. Please try again.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            showToast('New passwords do not match', 'error');
            return;
        }

        setIsLoading(true);
        try {
            await changePassword(user._id, {
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword,
                confirmPassword: passwordData.confirmPassword
            });
            showToast('Password changed successfully!', 'success');
            setShowPasswordChange(false);
            setPasswordData({
                currentPassword: '',
                newPassword: '',
                confirmPassword: '',
            });
        } catch (error: any) {
            console.error('Error changing password:', error);
            showToast(error.message || 'Failed to change password. Please try again.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRequestTeacher = async () => {
        setIsLoading(true);
        try {
            await requestTeacherAccess(user._id);
            const updatedUser = { ...user, teacherRequestStatus: 'pending' as const };
            updateProfile(updatedUser);
            showToast('Teacher access requested successfully!', 'success');
        } catch (error: any) {
            console.error('Error requesting teacher access:', error);
            showToast(error.message || 'Failed to request teacher access.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-6 bg-white dark:bg-gray-900 rounded-lg shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Profile Settings</h1>
                <button
                    onClick={onBack}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors duration-200"
                >
                    ← Back
                </button>
            </div>

            <div className="space-y-6">
                {/* Profile Information Card */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 sm:p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">Profile Information</h2>
                        {!isEditing && (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="px-3 py-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors duration-200"
                            >
                                Edit
                            </button>
                        )}
                    </div>

                    {isEditing ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Full Name
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleFormChange}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleFormChange}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Mobile Number
                                </label>
                                <input
                                    type="tel"
                                    name="mobileNumber"
                                    value={formData.mobileNumber}
                                    onChange={handleFormChange}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                    placeholder="Enter mobile number"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Class
                                </label>
                                <select
                                    name="class"
                                    value={formData.class}
                                    onChange={handleFormChange}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                >
                                    <option value="" disabled>Select Class</option>
                                    {classOptions.map((opt) => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    School Name
                                </label>
                                <input
                                    type="text"
                                    name="schoolName"
                                    value={formData.schoolName}
                                    onChange={handleFormChange}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    District
                                </label>
                                <select
                                    name="district"
                                    value={formData.district}
                                    onChange={handleFormChange}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                >
                                    <option value="" disabled>Select District</option>
                                    {Object.keys(KERALA_LOCATIONS).sort().map((district) => (
                                        <option key={district} value={district}>{district}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Sub-District
                                </label>
                                <select
                                    name="subDistrict"
                                    value={formData.subDistrict}
                                    onChange={handleFormChange}
                                    disabled={!formData.district}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
                                >
                                    <option value="" disabled>Select Sub-District</option>
                                    {availableSubDistricts.sort().map((sub) => (
                                        <option key={sub} value={sub}>{sub}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Role (Read-Only)
                                </label>
                                <input
                                    type="text"
                                    name="role"
                                    value={formData.role}
                                    disabled
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                                />
                                {user.role === 'student' && user.teacherRequestStatus !== 'pending' && user.teacherRequestStatus !== 'approved' && (
                                    <div className="flex items-center mt-3">
                                        <input
                                            type="checkbox"
                                            id="teacherRequest"
                                            checked={isTeacherRequested}
                                            onChange={(e) => setIsTeacherRequested(e.target.checked)}
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                                        />
                                        <label htmlFor="teacherRequest" className="ml-2 block text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                                            Request Teacher Access (School ID will be verified)
                                        </label>
                                    </div>
                                )}
                            </div>

                            <div className="md:col-span-2 flex space-x-3 pt-2">
                                <button
                                    onClick={handleSaveProfile}
                                    disabled={isLoading}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? 'Saving...' : 'Save Changes'}
                                </button>
                                <button
                                    onClick={() => setIsEditing(false)}
                                    disabled={isLoading}
                                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors duration-200 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center space-x-4">
                                <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-xl uppercase shadow-md">
                                    {user.name?.[0]}
                                </div>
                                <div>
                                    <h3 className="text-xl font-medium text-gray-900 dark:text-white">{user.name}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{user.role}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                                        Email
                                    </label>
                                    <p className="text-gray-900 dark:text-white font-medium">{user.email || 'Not provided'}</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                                        Mobile Number
                                    </label>
                                    <p className="text-gray-900 dark:text-white font-medium">{(user as any).mobileNumber || 'Not provided'}</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                                        Class
                                    </label>
                                    <p className="text-gray-900 dark:text-white font-medium">{(user as any).class || 'Not assigned'}</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                                        School Name
                                    </label>
                                    <p className="text-gray-900 dark:text-white font-medium">{(user as any).schoolName || 'Not provided'}</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                                        District
                                    </label>
                                    <p className="text-gray-900 dark:text-white font-medium">{(user as any).district || 'Not provided'}</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                                        Sub-District
                                    </label>
                                    <p className="text-gray-900 dark:text-white font-medium">{(user as any).subDistrict || 'Not provided'}</p>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                                        User ID
                                    </label>
                                    <p className="text-gray-500 dark:text-gray-400 font-mono text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded inline-block">{user._id}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Change Password Card */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 sm:p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">Security</h2>
                        {!showPasswordChange && (
                            <button
                                onClick={() => setShowPasswordChange(true)}
                                className="px-3 py-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors duration-200"
                            >
                                Change Password
                            </button>
                        )}
                    </div>

                    {showPasswordChange ? (
                        <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Current Password
                                </label>
                                <input
                                    type="password"
                                    name="currentPassword"
                                    value={passwordData.currentPassword}
                                    onChange={handlePasswordChange}
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    New Password
                                </label>
                                <input
                                    type="password"
                                    name="newPassword"
                                    value={passwordData.newPassword}
                                    onChange={handlePasswordChange}
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Confirm New Password
                                </label>
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    value={passwordData.confirmPassword}
                                    onChange={handlePasswordChange}
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                />
                            </div>
                            <div className="flex space-x-3">
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? 'Updating...' : 'Update Password'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowPasswordChange(false);
                                        setPasswordData({
                                            currentPassword: '',
                                            newPassword: '',
                                            confirmPassword: '',
                                        });
                                    }}
                                    disabled={isLoading}
                                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors duration-200 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div>
                            <p className="text-gray-600 dark:text-gray-400">
                                Change your password to keep your account secure.
                            </p>
                        </div>
                    )}
                </div>
                {/* Teacher Access Request Card */}
                {user.role === 'student' && (
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 sm:p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">Teacher Access</h2>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <p className="text-gray-600 dark:text-gray-400 mb-2">
                                    Are you a teacher? Request upgrade to teacher account to access additional features.
                                </p>
                                {user.teacherRequestStatus === 'pending' && (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                                        Request Pending Approval
                                    </span>
                                )}
                                {user.teacherRequestStatus === 'rejected' && (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                                        Request Rejected
                                    </span>
                                )}
                            </div>

                            {(user.teacherRequestStatus === 'none' || !user.teacherRequestStatus || user.teacherRequestStatus === 'rejected') && (
                                <button
                                    onClick={handleRequestTeacher}
                                    disabled={isLoading}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors duration-200 disabled:opacity-50 whitespace-nowrap"
                                >
                                    {isLoading ? 'Requesting...' : 'Request Access'}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};