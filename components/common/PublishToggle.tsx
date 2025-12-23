import React from 'react';

export const PublishToggle: React.FC<{ isPublished: boolean; onToggle: () => void }> = ({ isPublished, onToggle }) => (
    <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isPublished ? 'bg-green-500' : 'bg-gray-200'}`}
        title={isPublished ? "Published" : "Draft"}
    >
        <span
            className={`${isPublished ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
        />
    </button>
);
