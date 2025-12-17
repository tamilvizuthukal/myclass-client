import React from 'react';
import { ResourceType, ResourceCounts } from '../types';
import { useApi } from '../hooks/useApi';
import { getCountsByLessonId } from '../services/api';
import { RESOURCE_TYPES } from '../constants';

interface ResourceIconStripProps {
  lessonId: string | null;
  selectedType: ResourceType | null;
  onSelectType: (type: ResourceType) => void;
  collapsed?: boolean;
}

export const ResourceIconStrip: React.FC<ResourceIconStripProps> = ({
  lessonId,
  selectedType,
  onSelectType,
  collapsed = false,
}) => {
  const { data: counts } = useApi<ResourceCounts>(
    () => getCountsByLessonId(lessonId!),
    [lessonId],
    !!lessonId
  );

  return (
    <div className="flex flex-col gap-1.5">
      {RESOURCE_TYPES.map(r => {
        const count = counts?.[r.key] || 0;
        const isSelected = selectedType === r.key;
        return (
          <button
            key={r.key}
            onClick={() => onSelectType(r.key)}
            className={`
              relative flex items-center transition-all duration-300 group
              ${collapsed
                ? 'justify-center w-12 h-12 rounded-xl mx-auto'
                : 'w-full justify-start py-2.5 px-3 rounded-lg overflow-hidden'
              }
              ${isSelected
                ? (() => {
                  // Parse color from r.color (e.g., 'text-blue-600')
                  const parts = r.color.split('-');
                  const colorName = parts[1]; // e.g., 'blue'
                  const shade = parts[2] || '600'; // e.g., '600'
                  // Create same-color gradient (e.g., from-blue-600 to-blue-500)
                  return `bg-gradient-to-br from-${colorName}-${shade} to-${colorName}-${parseInt(shade) > 400 ? parseInt(shade) - 100 : parseInt(shade) + 100} text-white shadow-md`;
                })()
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }
            `}
            title={collapsed ? `${r.label} (${count})` : ''}
            aria-pressed={isSelected}
            disabled={!lessonId}
            style={{ opacity: !lessonId ? 0.5 : 1, cursor: !lessonId ? 'not-allowed' : 'pointer' }}
          >
            <r.Icon className={`
              shrink-0 transition-transform duration-200
              ${collapsed ? 'w-6 h-6' : 'w-5 h-5 mr-3'}
              ${!collapsed && isSelected ? 'scale-110' : ''}
              ${!isSelected ? r.color : 'text-white'}
            `} />

            {!collapsed && (
              <>
                <span className={`text-sm font-bold flex-1 text-left tracking-wide ${isSelected ? 'text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                  {r.label}
                </span>
                {count > 0 && (
                  <span className={`
                    ml-2 px-2 py-0.5 text-[10px] font-extrabold rounded-full shadow-sm
                    ${isSelected
                      ? 'bg-white/20 text-white backdrop-blur-sm'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600'
                    }
                  `}>
                    {count}
                  </span>
                )}
              </>
            )}

            {collapsed && count > 0 && (
              <span className={`absolute top-0 right-0 -mr-1 -mt-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white shadow ring-2 ring-white dark:ring-gray-900 ${r.color.replace('text-', 'bg-')}`}>
                {count > 9 ? '9+' : count}
              </span>
            )}

            {collapsed && (
              <div className="absolute left-full top-1/2 ml-3 -translate-y-1/2 px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-xl">
                {r.label}
                {/* Little triangle pointer */}
                <div className="absolute top-1/2 -left-1 -mt-1 border-4 border-transparent border-r-gray-900"></div>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};
