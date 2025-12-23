import { useCallback } from 'react';
import { Project, Animation, Template } from '../../../types';
import { generateId, getStorageData, saveStorageData } from '../../../utils';
import { calculateDuration } from '../services/animationCalculator';

export interface UseAnimationOperationsProps {
    project: Project | null;
    currentAnimation: Animation | undefined;
    selectedAnimationId: string;
    updateProject: (project: Project) => void;
    setSelectedAnimationId: (id: string) => void;
    setCurrentTime: (time: number) => void;
    openConfirmDialog: (title: string, message: string, onConfirm: () => void) => void;
    toast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export interface UseAnimationOperationsReturn {
    handleAddAnimation: () => void;
    handleRenameAnimation: (id: string, newName: string) => void;
    handleDeleteAnimation: (id: string) => void;
    handleReorderAnimations: (dragIdx: number, dropIdx: number) => void;
    handleSaveAnimAsTemplate: (id: string) => void;
    handleApplyTemplate: (template: Template) => void;
}

/**
 * 动画操作 Hook
 * 管理动画的 CRUD、排序、模板相关操作
 */
export const useAnimationOperations = ({
    project,
    currentAnimation,
    selectedAnimationId,
    updateProject,
    setSelectedAnimationId,
    setCurrentTime,
    openConfirmDialog,
    toast
}: UseAnimationOperationsProps): UseAnimationOperationsReturn => {
    
    const handleAddAnimation = useCallback(() => {
        if (!project) return;
        const newAnimName = `灯效 ${project.animations.length + 1}`;
        const newAnim = { id: generateId(), name: newAnimName, keyframes: [], duration: 5000 };
        updateProject({
            ...project,
            animations: [...project.animations, newAnim]
        });
        setSelectedAnimationId(newAnim.id);
        toast("已添加新灯效");
    }, [project, updateProject, setSelectedAnimationId, toast]);

    const handleRenameAnimation = useCallback((id: string, newName: string) => {
        if (!project) return;
        updateProject({
            ...project,
            animations: project.animations.map(a => a.id === id ? { ...a, name: newName } : a)
        });
    }, [project, updateProject]);

    const handleDeleteAnimation = useCallback((id: string) => {
        if (!project) return;
        if (project.animations.length <= 1) {
            toast("至少保留一个灯效", "error");
            return;
        }
        openConfirmDialog(
            "删除灯效",
            "确定删除此灯效？无法撤销。",
            () => {
                const newAnims = project.animations.filter(a => a.id !== id);
                updateProject({
                    ...project,
                    animations: newAnims
                });
                if (selectedAnimationId === id) {
                    setSelectedAnimationId(newAnims[0].id);
                }
                toast("灯效已删除");
            }
        );
    }, [project, selectedAnimationId, updateProject, setSelectedAnimationId, openConfirmDialog, toast]);

    const handleReorderAnimations = useCallback((dragIdx: number, dropIdx: number) => {
        if (!project) return;
        const items = Array.from(project.animations);
        const [reorderedItem] = items.splice(dragIdx, 1);
        items.splice(dropIdx, 0, reorderedItem);
        updateProject({ ...project, animations: items });
    }, [project, updateProject]);

    const handleSaveAnimAsTemplate = useCallback((id: string) => {
        if (!project) return;
        const anim = project.animations.find(a => a.id === id);
        if (!anim) return;
        
        const newTemplate: Template = {
            id: generateId(),
            name: anim.name + " (Template)",
            createdAt: Date.now(),
            keyframes: anim.keyframes.map(k => ({...k})), 
            lightGroupId: project.lightGroupId
        };
        
        const data = getStorageData();
        data.templates.push(newTemplate);
        saveStorageData(data);
        toast("灯效已保存为模板", "success");
    }, [project, toast]);

    const handleApplyTemplate = useCallback((template: Template) => {
        openConfirmDialog(
            "应用模板",
            `应用模板 "${template.name}"? 这将覆盖当前动画。`,
            () => {
                if (!currentAnimation || !project) return;

                const updatedAnim = {
                    ...currentAnimation,
                    keyframes: template.keyframes.map(k => ({...k, id: generateId()})), 
                };
                updatedAnim.duration = calculateDuration(updatedAnim.keyframes);

                const updatedProject = {
                    ...project,
                    animations: project.animations.map(a => a.id === selectedAnimationId ? updatedAnim : a)
                };
                updateProject(updatedProject);
                setCurrentTime(0);
                toast("模板已应用", "success");
            }
        );
    }, [currentAnimation, project, selectedAnimationId, updateProject, setCurrentTime, openConfirmDialog, toast]);

    return {
        handleAddAnimation,
        handleRenameAnimation,
        handleDeleteAnimation,
        handleReorderAnimations,
        handleSaveAnimAsTemplate,
        handleApplyTemplate
    };
};

