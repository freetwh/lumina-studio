import { useCallback } from 'react';
import { Project } from '../../../types';
import { generateId } from '../../../utils';

export interface UseSelectionOperationsProps {
    project: Project | null;
    selectedLightIds: Set<string>;
    setSelectedLightIds: (ids: Set<string>) => void;
    updateProject: (project: Project) => void;
    openSelectionDialog: (defaultName: string) => void;
    openConfirmDialog: (title: string, message: string, onConfirm: () => void) => void;
    toast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export interface UseSelectionOperationsReturn {
    handleSaveSelection: () => void;
    handleConfirmSaveSelection: (name: string) => void;
    handleRestoreSelection: (ids: string[]) => void;
    handleDeleteSelection: (id: string) => void;
}

/**
 * 选区操作 Hook
 * 管理选区的保存、恢复、删除操作
 */
export const useSelectionOperations = ({
    project,
    selectedLightIds,
    setSelectedLightIds,
    updateProject,
    openSelectionDialog,
    openConfirmDialog,
    toast
}: UseSelectionOperationsProps): UseSelectionOperationsReturn => {
    
    const handleSaveSelection = useCallback(() => {
        if (selectedLightIds.size === 0 || !project) {
            toast("请先选择灯珠！", "error");
            return;
        }
        openSelectionDialog("选区 " + ((project.savedSelections?.length || 0) + 1));
    }, [selectedLightIds, project, openSelectionDialog, toast]);

    const handleConfirmSaveSelection = useCallback((name: string) => {
        if (!project || !name) return;
        const newSelection = {
            id: generateId(),
            name: name,
            lightIds: Array.from(selectedLightIds)
        };
        const updatedProject = {
            ...project,
            savedSelections: [...(project.savedSelections || []), newSelection]
        };
        updateProject(updatedProject);
        toast(`选区 "${name}" 保存成功！`, "success");
    }, [project, selectedLightIds, updateProject, toast]);

    const handleRestoreSelection = useCallback((ids: string[]) => {
        setSelectedLightIds(new Set(ids));
    }, [setSelectedLightIds]);

    const handleDeleteSelection = useCallback((id: string) => {
        openConfirmDialog(
            "删除选区",
            "确定删除此选区记录？",
            () => {
                if (!project) return;
                const updatedProject = {
                    ...project,
                    savedSelections: (project.savedSelections || []).filter(s => s.id !== id)
                };
                updateProject(updatedProject);
                toast("选区已删除");
            }
        );
    }, [project, updateProject, openConfirmDialog, toast]);

    return {
        handleSaveSelection,
        handleConfirmSaveSelection,
        handleRestoreSelection,
        handleDeleteSelection
    };
};

