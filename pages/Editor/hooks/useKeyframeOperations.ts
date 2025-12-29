import { useCallback } from 'react';
import { Project, Animation, Keyframe } from '../../../types';
import { generateId, generateAnimationKeyframes } from '../../../utils';
import { calculateDuration } from '../services/animationCalculator';
import { findAvailableTrack } from '../services/collisionDetector';

export interface UseKeyframeOperationsProps {
    project: Project | null;
    currentAnimation: Animation | undefined;
    selectedAnimationId: string;
    currentTime: number;
    selectedLightIds: Set<string>;
    selectedKeyframeId: string | null;
    updateProject: (project: Project) => void;
    setSelectedKeyframeId: (id: string | null) => void;
    toast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export interface UseKeyframeOperationsReturn {
    handleAddKeyframe: (type: string) => void;
    handleUpdateKeyframe: (kfId: string, updates: Partial<Keyframe>) => void;
    handleDeleteKeyframe: () => void;
    handleDuplicateKeyframe: () => void;
}

/**
 * 关键帧操作 Hook
 * 管理关键帧的 CRUD 操作
 */
export const useKeyframeOperations = ({
    project,
    currentAnimation,
    selectedAnimationId,
    currentTime,
    selectedLightIds,
    selectedKeyframeId,
    updateProject,
    setSelectedKeyframeId,
    toast
}: UseKeyframeOperationsProps): UseKeyframeOperationsReturn => {
    
    const handleAddKeyframe = useCallback((type: string) => {
        if (!currentAnimation || !project || selectedLightIds.size === 0) {
            if (selectedLightIds.size === 0) toast("请先选择灯珠", "error");
            return;
        }

        const baseDuration = 2000; // 基础动画时长 2 秒
        const color = type === 'flash' ? '#ffffff' : '#ff0000';
        
        // 生成多个连贯的关键帧
        const newKeyframes = generateAnimationKeyframes(
            type,
            currentTime,
            baseDuration,
            Array.from(selectedLightIds),
            0,
            color
        );

        // 为每个关键帧查找可用轨道并更新
        const keyframesWithTracks = newKeyframes.map(kf => {
            const targetTrack = findAvailableTrack(
                kf.startTime,
                kf.duration,
                currentAnimation.keyframes
            );
            return { ...kf, trackId: targetTrack };
        });

        const updatedAnim = {
            ...currentAnimation,
            keyframes: [...currentAnimation.keyframes, ...keyframesWithTracks]
        };
        updatedAnim.duration = calculateDuration(updatedAnim.keyframes);

        const updatedProject = {
            ...project,
            animations: project.animations.map(a => a.id === selectedAnimationId ? updatedAnim : a)
        };

        updateProject(updatedProject);
        // 选中第一个关键帧
        if (keyframesWithTracks.length > 0) {
            setSelectedKeyframeId(keyframesWithTracks[0].id);
        }
    }, [currentAnimation, project, selectedAnimationId, currentTime, selectedLightIds, updateProject, setSelectedKeyframeId, toast]);

    const handleUpdateKeyframe = useCallback((kfId: string, updates: Partial<Keyframe>) => {
        if (!currentAnimation || !project) return;
        
        const updatedKeyframes = currentAnimation.keyframes.map(k => 
            k.id === kfId ? { ...k, ...updates } : k
        );
        const updatedAnim = { ...currentAnimation, keyframes: updatedKeyframes };
        updatedAnim.duration = calculateDuration(updatedKeyframes);

        const updatedProject = {
            ...project,
            animations: project.animations.map(a => a.id === selectedAnimationId ? updatedAnim : a)
        };
        updateProject(updatedProject);
    }, [currentAnimation, project, selectedAnimationId, updateProject]);

    const handleDeleteKeyframe = useCallback(() => {
        if (!selectedKeyframeId || !currentAnimation || !project) return;
        const kfToDelete = currentAnimation.keyframes.find(k => k.id === selectedKeyframeId);
        if (!kfToDelete) return;

        let remainingKeyframes = currentAnimation.keyframes.filter(k => k.id !== selectedKeyframeId);
        remainingKeyframes = remainingKeyframes.map(k => {
            if (k.trackId === kfToDelete.trackId && k.startTime > kfToDelete.startTime) {
                return { ...k, startTime: k.startTime - kfToDelete.duration };
            }
            return k;
        });

        const updatedAnim = { ...currentAnimation, keyframes: remainingKeyframes };
        updatedAnim.duration = calculateDuration(remainingKeyframes);

        const updatedProject = {
            ...project,
            animations: project.animations.map(a => a.id === selectedAnimationId ? updatedAnim : a)
        };
        updateProject(updatedProject);
        setSelectedKeyframeId(null);
    }, [selectedKeyframeId, currentAnimation, project, selectedAnimationId, updateProject, setSelectedKeyframeId]);

    const handleDuplicateKeyframe = useCallback(() => {
        if (!selectedKeyframeId || !currentAnimation || !project) return;
        const kf = currentAnimation.keyframes.find(k => k.id === selectedKeyframeId);
        if (!kf) return;
        
        const newKf = { 
            ...kf, 
            id: generateId(), 
            startTime: kf.startTime + kf.duration 
        };
        
        const updatedAnim = { ...currentAnimation, keyframes: [...currentAnimation.keyframes, newKf] };
        updatedAnim.duration = calculateDuration(updatedAnim.keyframes);
        
        const updatedProject = {
            ...project,
            animations: project.animations.map(a => a.id === selectedAnimationId ? updatedAnim : a)
        };
        updateProject(updatedProject);
    }, [selectedKeyframeId, currentAnimation, project, selectedAnimationId, updateProject]);

    return {
        handleAddKeyframe,
        handleUpdateKeyframe,
        handleDeleteKeyframe,
        handleDuplicateKeyframe
    };
};

