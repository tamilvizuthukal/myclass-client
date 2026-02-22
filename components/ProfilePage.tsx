import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { updateUserProfile, changePassword } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useSession } from '../context/SessionContext';

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

export const ProfilePage: React.FC<{ user: User; onBack: () => void }> = ({ user, onBack }) => {
    const { updateProfile } = useSession();
    const [isEditing, setIsEditing] = useState(false);
    const [showPasswordChange, setShowPasswordChange] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { showToast } = useToast();

    const [formData, setFormData] = useState({
        name: user.name || '', email: user.email || '', role: user.role, mobileNumber: (user as any).mobileNumber || '',
        class: (user as any).class || '', schoolName: (user as any).schoolName || '', district: (user as any).district || '', subDistrict: (user as any).subDistrict || ''
    });

    useEffect(() => {
        setFormData({
            name: user.name || '', email: user.email || '', role: user.role, mobileNumber: (user as any).mobileNumber || '',
            class: (user as any).class || '', schoolName: (user as any).schoolName || '', district: (user as any).district || '', subDistrict: (user as any).subDistrict || ''
        });
    }, [user]);

    const [availableSubDistricts, setAvailableSubDistricts] = useState<string[]>([]);
    const classOptions = Array.from({ length: 12 }, (_, i) => `Class ${i + 1}`);

    const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

    useEffect(() => {
        if (formData.district && KERALA_LOCATIONS[formData.district]) setAvailableSubDistricts(KERALA_LOCATIONS[formData.district]);
        else setAvailableSubDistricts([]);
    }, [formData.district]);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === 'district') setFormData({ ...formData, district: value, subDistrict: '' });
        else setFormData({ ...formData, [name]: value });
    };

    const handleSaveProfile = async () => {
        setIsLoading(true);
        try {
            const response = await updateUserProfile(user._id, {
                name: formData.name, email: formData.email, mobileNumber: formData.mobileNumber,
                class: formData.class, schoolName: formData.schoolName, district: formData.district, subDistrict: formData.subDistrict
            });
            if (response.success && response.user) {
                updateProfile(response.user);
                setIsEditing(false);
                showToast('Profile updated successfully!', 'success');
            } else throw new Error(response.message);
        } catch (e: any) { showToast(e.message || 'Update failed', 'error'); }
        finally { setIsLoading(false); }
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordData.newPassword !== passwordData.confirmPassword) return showToast('Passwords match missing', 'error');
        setIsLoading(true);
        try {
            await changePassword(user._id, passwordData);
            showToast('Password changed!', 'success');
            setShowPasswordChange(false);
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (e: any) { showToast(e.message || 'Password change failed', 'error'); }
        finally { setIsLoading(false); }
    };

    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-6 bg-white dark:bg-gray-900 rounded-lg shadow-lg">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl sm:text-2xl font-bold">Profile Settings</h1>
                <button onClick={onBack} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-md">← Back</button>
            </div>
            <div className="space-y-6">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
                    <div className="flex justify-between mb-4">
                        <h2 className="text-lg font-semibold">Information</h2>
                        {!isEditing && <button onClick={() => setIsEditing(true)} className="text-blue-600">Edit</button>}
                    </div>
                    {isEditing ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2"><label className="block text-sm mb-1">Name</label>
                                <input type="text" name="name" value={formData.name} onChange={handleFormChange} className="w-full p-2 border rounded dark:bg-gray-700" /></div>
                            <div><label className="block text-sm mb-1">Email</label>
                                <input type="email" name="email" value={formData.email} onChange={handleFormChange} className="w-full p-2 border rounded dark:bg-gray-700" /></div>
                            <div><label className="block text-sm mb-1">Mobile</label>
                                <input type="tel" name="mobileNumber" value={formData.mobileNumber} onChange={handleFormChange} className="w-full p-2 border rounded dark:bg-gray-700" /></div>
                            <div><label className="block text-sm mb-1">Class</label>
                                <select name="class" value={formData.class} onChange={handleFormChange} className="w-full p-2 border rounded dark:bg-gray-700">
                                    <option value="">Select Class</option>{classOptions.map(o => <option key={o} value={o}>{o}</option>)}
                                </select></div>
                            <div><label className="block text-sm mb-1">School</label>
                                <input type="text" name="schoolName" value={formData.schoolName} onChange={handleFormChange} className="w-full p-2 border rounded dark:bg-gray-700" /></div>
                            <div><label className="block text-sm mb-1">District</label>
                                <select name="district" value={formData.district} onChange={handleFormChange} className="w-full p-2 border rounded dark:bg-gray-700">
                                    <option value="">SelectDistrict</option>{Object.keys(KERALA_LOCATIONS).sort().map(d => <option key={d} value={d}>{d}</option>)}
                                </select></div>
                            <div><label className="block text-sm mb-1">Sub-District</label>
                                <select name="subDistrict" value={formData.subDistrict} onChange={handleFormChange} disabled={!formData.district} className="w-full p-2 border rounded dark:bg-gray-700">
                                    <option value="">Select Sub-District</option>{availableSubDistricts.sort().map(s => <option key={s} value={s}>{s}</option>)}
                                </select></div>
                            <div className="md:col-span-2 flex gap-3 pt-2">
                                <button onClick={handleSaveProfile} disabled={isLoading} className="px-4 py-2 bg-blue-600 text-white rounded">{isLoading ? 'Saving...' : 'Save'}</button>
                                <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-gray-600 text-white rounded">Cancel</button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center gap-4"><div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white text-xl uppercase">{user.name?.[0]}</div>
                                <div><h3 className="text-xl font-medium">{user.name}</h3><p className="text-gray-500 capitalize">{user.role}</p></div></div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                                <div><label className="text-xs text-gray-500 uppercase">Email</label><p>{user.email || 'N/A'}</p></div>
                                <div><label className="text-xs text-gray-500 uppercase">Mobile</label><p>{(user as any).mobileNumber || 'N/A'}</p></div>
                                <div><label className="text-xs text-gray-500 uppercase">Class</label><p>{(user as any).class || 'N/A'}</p></div>
                                <div><label className="text-xs text-gray-500 uppercase">School</label><p>{(user as any).schoolName || 'N/A'}</p></div>
                                <div><label className="text-xs text-gray-500 uppercase">District</label><p>{(user as any).district || 'N/A'}</p></div>
                                <div><label className="text-xs text-gray-500 uppercase">Sub-District</label><p>{(user as any).subDistrict || 'N/A'}</p></div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
                    <div className="flex justify-between mb-4"><h2 className="text-lg font-semibold">Security</h2>
                        {!showPasswordChange && <button onClick={() => setShowPasswordChange(true)} className="text-blue-600">Change Password</button>}</div>
                    {showPasswordChange ? (
                        <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
                            <input type="password" name="currentPassword" placeholder="Current Password" onChange={e => setPasswordData({ ...passwordData, currentPassword: e.target.value })} required className="w-full p-2 border rounded dark:bg-gray-700" />
                            <input type="password" name="newPassword" placeholder="New Password" onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })} required className="w-full p-2 border rounded dark:bg-gray-700" />
                            <input type="password" name="confirmPassword" placeholder="Confirm Password" onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })} required className="w-full p-2 border rounded dark:bg-gray-700" />
                            <div className="flex gap-3"><button type="submit" disabled={isLoading} className="px-4 py-2 bg-blue-600 text-white rounded">Update</button>
                                <button type="button" onClick={() => setShowPasswordChange(false)} className="px-4 py-2 bg-gray-600 text-white rounded">Cancel</button></div>
                        </form>
                    ) : <p className="text-gray-500 text-sm">Update your password to stay secure.</p>}
                </div>
            </div>
        </div>
    );
};