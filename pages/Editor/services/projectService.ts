import { getStorageData, saveStorageData } from '../../../utils';
import { Project } from '../../../types';

/**
 * 更新项目并持久化到 localStorage
 */
export const updateProjectInStorage = (updatedProject: Project): void => {
    const data = getStorageData();
    const idx = data.projects.findIndex(p => p.id === updatedProject.id);
    if (idx !== -1) {
        data.projects[idx] = updatedProject;
        saveStorageData(data);
    }
};

/**
 * 从 localStorage 加载项目
 */
export const loadProjectById = (projectId: string): Project | null => {
    const data = getStorageData();
    const proj = data.projects.find(p => p.id === projectId);
    return proj || null;
};

