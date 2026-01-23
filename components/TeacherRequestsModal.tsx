import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { getTeacherRequests, approveTeacherRequest, rejectTeacherRequest } from '../services/api';
import { useToast } from '../context/ToastContext';

interface TeacherRequestsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const TeacherRequestsModal: React.FC<TeacherRequestsModalProps> = ({ isOpen, onClose }) => {
    const [requests, setRequests] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const { showToast } = useToast();

    const fetchRequests = async () => {
        setIsLoading(true);
        try {
            const data = await getTeacherRequests();
            setRequests(data);
        } catch (error) {
            console.error('Error fetching teacher requests:', error);
            showToast('Failed to load requests', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchRequests();
        }
    }, [isOpen]);

    const handleApprove = async (userId: string) => {
        try {
            await approveTeacherRequest(userId);
            showToast('Request approved successfully', 'success');
            fetchRequests(); // Refresh list
        } catch (error) {
            console.error('Error approving request:', error);
            showToast('Failed to approve request', 'error');
        }
    };

    const handleReject = async (userId: string) => {
        try {
            await rejectTeacherRequest(userId);
            showToast('Request rejected', 'success');
            fetchRequests(); // Refresh list
        } catch (error) {
            console.error('Error rejecting request:', error);
            showToast('Failed to reject request', 'error');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={onClose}></div>

                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                    <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white" id="modal-title">
                                Pending Teacher Requests
                            </h3>
                            <button
                                onClick={onClose}
                                className="text-gray-400 hover:text-gray-500 focus:outline-none"
                            >
                                <span className="sr-only">Close</span>
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {isLoading ? (
                            <div className="flex justify-center py-6">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                            </div>
                        ) : requests.length === 0 ? (
                            <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                                No pending requests found.
                            </div>
                        ) : (
                            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                                {requests.map((request) => (
                                    <li key={request._id} className="py-4">
                                        <div className="flex items-center space-x-4">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                    {request.name}
                                                </p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                                    {request.email}
                                                </p>
                                                <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                                                    ID: {request._id} • {request.schoolName}
                                                </p>
                                            </div>
                                            <div className="inline-flex items-center space-x-2">
                                                <button
                                                    onClick={() => handleApprove(request._id)}
                                                    className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={() => handleReject(request._id)}
                                                    className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
