import { useState, useEffect } from 'react';
import { Project, AnimationNode, Template } from '../../../types';
import { generateId, getStorageData, saveStorageData } from '../../../utils';

export interface UseTemplateOperationsProps {
    project: Project | null;
    currentAnimation: AnimationNode | undefined;
    selectedAnimationId: string;
    templates: Template[];
    updateProject: (project: Project) => void;
    setCurrentTime: (time: number) => void;
    toast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export interface UseTemplateOperationsReturn {
    localTemplates: Template[];
    handleSaveAnimAsTemplate: (id: string) => void;
    handleSaveAsTemplate: (name: string) => void;
    handleApplyTemplate: (template: Template, onConfirm: () => void) => void;
}

/**
 * 模板操作 Hook
 * 管理模板的保存和应用
 */
export const useTemplateOperations = ({
    project,
    currentAnimation,
    selectedAnimationId,
    templates,
    updateProject,
    setCurrentTime,
    toast
}: UseTemplateOperationsProps): UseTemplateOperationsReturn => {
    const [localTemplates, setLocalTemplates] = useState<Template[]>([]);

    useEffect(() => {
        setLocalTemplates(templates);
    }, [templates]);

    // 从动画快速保存为模板
    const handleSaveAnimAsTemplate = (id: string) => {
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
        
        const updatedData = getStorageData();
        setLocalTemplates(updatedData.templates);
        toast("灯效已保存为模板", "success");
    };

    // 从弹窗保存为模板
    const handleSaveAsTemplate = (name: string) => {
        if (!name || !currentAnimation || !project) return;
        
        const newTemplate: Template = {
            id: generateId(),
            name: name,
            createdAt: Date.now(),
            keyframes: currentAnimation.keyframes.map(k => ({...k})), 
            lightGroupId: project.lightGroupId
        };
        
        const data = getStorageData();
        data.templates.push(newTemplate);
        saveStorageData(data);
        
        const updatedData = getStorageData();
        setLocalTemplates(updatedData.templates);
        toast("模板已保存！", "success");
    };

    // 应用模板（需要外部确认）
    const handleApplyTemplate = (template: Template, onConfirm: () => void) => {
        if (!currentAnimation || !project) return;

        const updatedAnim = {
            ...currentAnimation,
            keyframes: template.keyframes.map(k => ({...k, id: generateId()})), 
        };

        const updatedProject = {
            ...project,
            animations: project.animations.map(a => a.id === selectedAnimationId ? updatedAnim : a)
        };
        
        updateProject(updatedProject);
        setCurrentTime(0);
        toast("模板已应用", "success");
        onConfirm();
    };

    return {
        localTemplates,
        handleSaveAnimAsTemplate,
        handleSaveAsTemplate,
        handleApplyTemplate
    };
};

