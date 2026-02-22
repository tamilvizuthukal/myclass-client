import React, { useEffect, useState, useRef } from 'react';
import { useApi } from '../hooks/useApi';
import { getClasses, getSubjectsByClassId, getUnitsBySubjectId, getSubUnitsByUnitId, getLessonsBySubUnitId } from '../services/api';
import { Class, Subject, Unit, SubUnit, Lesson } from '../types';
import { SelectionModal } from './SelectionModal';

interface CascadeSelectorsProps {
  classId: string | null;
  subjectId: string | null;
  unitId: string | null;
  subUnitId: string | null;
  lessonId: string | null;
  onClassChange: (id: string | null) => void;
  onSubjectChange: (id: string | null) => void;
  onUnitChange: (id: string | null) => void;
  onSubUnitChange: (id: string | null) => void;
  onLessonChange: (id: string | null) => void;
  onModalToggle?: (isOpen: boolean) => void;
  lockedClassName?: string;
}

export const CascadeSelectors: React.FC<CascadeSelectorsProps> = ({
  classId,
  subjectId,
  unitId,
  subUnitId,
  lessonId,
  onClassChange,
  onSubjectChange,
  onUnitChange,
  onSubUnitChange,
  onLessonChange,
  onModalToggle,
  lockedClassName
}) => {
  const { data: classes, isLoading: isLoadingClasses } = useApi<Class[]>(() => getClasses(), []);
  const { data: subjects, isLoading: isLoadingSubjects } = useApi<Subject[]>(
    () => getSubjectsByClassId(classId!),
    [classId],
    !!classId,
    { keepPreviousData: false }
  );
  const { data: units, isLoading: isLoadingUnits } = useApi<Unit[]>(
    () => getUnitsBySubjectId(subjectId!),
    [subjectId],
    !!subjectId,
    { keepPreviousData: false }
  );
  const { data: subUnits, isLoading: isLoadingSubUnits } = useApi<SubUnit[]>(
    () => getSubUnitsByUnitId(unitId!),
    [unitId],
    !!unitId,
    { keepPreviousData: false }
  );
  const { data: lessons, isLoading: isLoadingLessons } = useApi<Lesson[]>(
    () => getLessonsBySubUnitId(subUnitId!),
    [subUnitId],
    !!subUnitId,
    { keepPreviousData: false }
  );

  useEffect(() => {
    if (lockedClassName && classes && classes.length > 0) {
      const normalizedLocked = lockedClassName.toLowerCase().trim();
      const lockedClass = classes.find(c => {
        const normalizedName = c.name.toLowerCase().trim();
        return normalizedName === normalizedLocked ||
          normalizedName === normalizedLocked.replace('class ', '').trim() ||
          normalizedName.replace('class ', '').trim() === normalizedLocked;
      });

      if (lockedClass && classId !== lockedClass._id) {
        onClassChange(lockedClass._id);
      }
    }
  }, [lockedClassName, classes, classId, onClassChange]);

  useEffect(() => {
    if (unitId && !isLoadingSubUnits && subUnits && subUnits.length === 0) {
      if (lessonId !== unitId) {
        onLessonChange(unitId);
      }
    }
  }, [unitId, subUnits, isLoadingSubUnits, lessonId, onLessonChange]);

  useEffect(() => {
    if (subUnitId && !isLoadingLessons && lessons && lessons.length === 0) {
      if (lessonId !== subUnitId) {
        onLessonChange(subUnitId);
      }
    }
  }, [subUnitId, lessons, isLoadingLessons, lessonId, onLessonChange]);

  const [isModalOpen, setIsModalOpen] = useState(false);

  const getCurrentClassDisplay = () => {
    if (!classId || !classes) return null;
    const selectedClass = classes.find(c => c._id === classId);
    return selectedClass?.name || null;
  };

  const getCurrentSubjectDisplay = () => {
    if (!subjectId || !subjects) return null;
    const selectedSubject = subjects.find(s => s._id === subjectId);
    return selectedSubject?.name || null;
  };

  const getFinalSelectedDisplay = () => {
    if (lessonId && lessons) {
      const selectedLesson = lessons.find(l => l._id === lessonId);
      return selectedLesson?.name || null;
    }
    if (subUnitId && subUnits) {
      const selectedSubUnit = subUnits.find(s => s._id === subUnitId);
      return selectedSubUnit?.name || null;
    }
    if (unitId && units) {
      const selectedUnit = units.find(u => u._id === unitId);
      return selectedUnit?.name || null;
    }
    if (subjectId && subjects) {
      const selectedSubject = subjects.find(s => s._id === subjectId);
      return selectedSubject?.name || null;
    }
    return null;
  };

  const getMobileDisplayText = () => {
    const className = getCurrentClassDisplay();
    const subjectName = getCurrentSubjectDisplay();
    const finalSelection = getFinalSelectedDisplay();

    if (!className && !subjectName && !finalSelection) {
      return 'Choose Class, Subject, Unit, Sub-Unit & Chapter';
    }

    const parts = [];
    if (className) parts.push(className.length > 15 ? className.substring(0, 12) + '...' : className);
    if (subjectName) {
      const maxLength = parts.length === 0 ? 20 : 15;
      parts.push(subjectName.length > maxLength ? subjectName.substring(0, maxLength - 3) + '...' : subjectName);
    }
    if (finalSelection) {
      const maxLength = parts.length === 0 ? 25 : (parts.length === 1 ? 18 : 12);
      parts.push(finalSelection.length > maxLength ? finalSelection.substring(0, maxLength - 3) + '...' : finalSelection);
    }

    return parts.join(' › ');
  };

  const initialAutoOpenDone = useRef(false);

  useEffect(() => {
    if (!initialAutoOpenDone.current && classes && classes.length > 0) {
      if (!classId || !subjectId) {
        setIsModalOpen(true);
        onModalToggle?.(true);
      }
      initialAutoOpenDone.current = true;
    }
  }, [classId, subjectId, classes, onModalToggle]);

  const handleModalOpen = () => {
    setIsModalOpen(true);
    onModalToggle?.(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    onModalToggle?.(false);
  };

  const handleSave = () => {
    setIsModalOpen(false);
    onModalToggle?.(false);
  };

  return (
    <>
      <div className="hidden md:block p-4 bg-white dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <div className="flex flex-wrap gap-3 lg:gap-4 overflow-hidden">
          <Selector
            label="Class"
            value={classId}
            onChange={(e) => onClassChange(e.target.value || null)}
            options={classes}
            isLoading={isLoadingClasses}
            disabled={!!lockedClassName}
          />
          {classId && (
            <Selector
              label="Subject"
              value={subjectId}
              onChange={(e) => onSubjectChange(e.target.value || null)}
              options={subjects}
              isLoading={isLoadingSubjects}
              disabled={!classId}
              className="animate-fade-in"
            />
          )}
          {subjectId && (
            <Selector
              label="Unit"
              value={unitId}
              onChange={(e) => onUnitChange(e.target.value || null)}
              options={units}
              isLoading={isLoadingUnits}
              disabled={!subjectId}
              className="animate-fade-in"
            />
          )}
          {unitId && (isLoadingSubUnits || (subUnits && subUnits.length > 0)) && (
            <Selector
              label="Sub-Unit"
              value={subUnitId}
              onChange={(e) => onSubUnitChange(e.target.value || null)}
              options={subUnits}
              isLoading={isLoadingSubUnits}
              disabled={!unitId}
              className="animate-fade-in"
            />
          )}
          {subUnitId && (isLoadingLessons || (lessons && lessons.length > 0)) && (
            <Selector
              label="Chapter"
              value={lessonId}
              onChange={(e) => onLessonChange(e.target.value || null)}
              options={lessons}
              isLoading={isLoadingLessons}
              disabled={!subUnitId}
              className="animate-fade-in"
            />
          )}
        </div>
      </div>

      <div className="md:hidden shrink-0">
        <button
          onClick={handleModalOpen}
          className="w-full flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 shadow-sm rounded-md"
        >
          <div className="flex-1 min-w-0 px-3 py-2 text-left">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate leading-tight">
              {getMobileDisplayText()}
            </p>
          </div>
          <div className="flex-shrink-0 px-3 py-2">
            <div className="p-1.5 rounded-md bg-gray-100 dark:bg-gray-700">
              <svg className="h-4 w-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </button>
      </div>

      <SelectionModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        classId={classId}
        subjectId={subjectId}
        unitId={unitId}
        subUnitId={subUnitId}
        lessonId={lessonId}
        onClassChange={onClassChange}
        onSubjectChange={onSubjectChange}
        onUnitChange={onUnitChange}
        onSubUnitChange={onSubUnitChange}
        onLessonChange={onLessonChange}
        onSave={handleSave}
        defaultClass="8"
        lockedClassName={lockedClassName}
      />
    </>
  );
};

const Selector: React.FC<{
  label: string;
  value: string | null;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { _id: string; name: string }[] | null;
  isLoading: boolean;
  disabled: boolean;
  className?: string;
}> = ({ label, value, onChange, options, isLoading, disabled, className }) => (
  <div className={`relative flex-1 min-w-[160px] max-w-[200px] ${className || ''}`}>
    <select
      value={value || ''}
      onChange={onChange}
      disabled={disabled || isLoading}
      className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed truncate"
    >
      <option value="" disabled>{isLoading ? 'Loading...' : `Select ${label}`}</option>
      {options?.map(opt => (
        <option key={opt._id} value={opt._id} className="truncate">
          {opt.name}
        </option>
      ))}
    </select>
  </div>
);
