import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStorageData, generateId } from '../../../utils';
import { Project, LightGroup, Template } from '../../../types';
import { useHistory } from '../../../hooks/useHistory';
import { updateProjectInStorage } from '../services/projectService';

export interface UseProjectDataReturn {
    project: Project | null;
    lightGroup: LightGroup | null;
    templates: Template[];
    updateProject: (updatedProject: Project) => void;
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
}

export const useProjectData = (projectId: string | undefined): UseProjectDataReturn => {
    const navigate = useNavigate();
    const { state: project, set: setProjectHistory, undo, redo, canUndo, canRedo, init: initHistory } = useHistory<Project>(null);
    const [lightGroup, setLightGroup] = useState<LightGroup | null>(null);
    const [templates, setTemplates] = useState<Template[]>([]);

    // 加载工程数据
    useEffect(() => {
        if (!projectId) return;
        const data = getStorageData();
        const proj = data.projects.find(p => p.id === projectId);
        if (!proj) {
            navigate('/');
            return;
        }
        
        // 确保至少有一个动画
        if (proj.animations.length === 0) {
            proj.animations.push({ id: generateId(), name: '灯效 1', keyframes: [], duration: 5000 });
        } else {
            // 重命名旧版本的"主动画"
            proj.animations.forEach((a, i) => { if (a.name === '主动画') a.name = `灯效 ${i + 1}`; });
        }

        initHistory(proj); 
        setTemplates(data.templates);
        
        // 加载灯光组
        const grp = data.lightGroups.find(g => g.id === proj.lightGroupId);
        if (grp) {
            setLightGroup(grp);
        } else {
            if (data.lightGroups.length > 0) {
                setLightGroup(data.lightGroups[0]);
            } else {
                setLightGroup(null);
            }
        }
    }, [projectId, navigate, initHistory]);

    const updateProject = (updatedProject: Project) => {
        setProjectHistory(updatedProject); 
        updateProjectInStorage(updatedProject);
    };

    return {
        project,
        lightGroup,
        templates,
        updateProject,
        undo,
        redo,
        canUndo,
        canRedo
    };
};

