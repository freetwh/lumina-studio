import { useState, useCallback } from 'react';
import { Project, Animation } from '../../../types';
import { useAnimationLoop } from '../../../hooks/useAnimationLoop';

export interface UseAnimationPlaybackProps {
    project: Project | null;
    currentAnimation: Animation | undefined;
    selectedAnimationId: string;
    setSelectedAnimationId: (id: string) => void;
}

export interface UseAnimationPlaybackReturn {
    isPlaying: boolean;
    setIsPlaying: (playing: boolean) => void;
    currentTime: number;
    setCurrentTime: (time: number) => void;
    isLooping: boolean;
    setIsLooping: (looping: boolean) => void;
    globalPlayMode: boolean;
    setGlobalPlayMode: (mode: boolean) => void;
    handlePlayPause: () => void;
    handleStop: () => void;
    handleLoopToggle: () => void;
}

/**
 * 动画播放控制 Hook
 * 管理动画的播放、暂停、停止、循环、全局播放等
 */
export const useAnimationPlayback = ({
    project,
    currentAnimation,
    selectedAnimationId,
    setSelectedAnimationId
}: UseAnimationPlaybackProps): UseAnimationPlaybackReturn => {
    const [isLooping, setIsLooping] = useState(false);
    const [globalPlayMode, setGlobalPlayMode] = useState(false);

    const duration = currentAnimation ? currentAnimation.duration : 5000;

    // 播放完成后的回调，用于全局顺序播放
    const handleAnimationFinish = useCallback(() => {
        if (!globalPlayMode || !project) return;
        
        const currentIndex = project.animations.findIndex(a => a.id === selectedAnimationId);
        if (currentIndex !== -1 && currentIndex < project.animations.length - 1) {
            // 播放下一个
            const nextAnim = project.animations[currentIndex + 1];
            setSelectedAnimationId(nextAnim.id);
            setCurrentTime(0);
        } else {
            // 全部播放完毕
            setIsPlaying(false);
            setGlobalPlayMode(false);
            setCurrentTime(0);
            // 回到第一个
            if (project.animations.length > 0) {
                setSelectedAnimationId(project.animations[0].id);
            }
        }
    }, [globalPlayMode, project, selectedAnimationId, setSelectedAnimationId]);

    const { isPlaying, setIsPlaying, currentTime, setCurrentTime } = useAnimationLoop(
        duration, 
        isLooping, 
        handleAnimationFinish
    );

    const handlePlayPause = useCallback(() => {
        if (isPlaying && globalPlayMode) {
            setIsPlaying(false);
            setGlobalPlayMode(false);
        } else {
            setGlobalPlayMode(true);
            setIsPlaying(true);
        }
    }, [isPlaying, globalPlayMode, setIsPlaying]);

    const handleStop = useCallback(() => {
        setIsPlaying(false);
        setGlobalPlayMode(false);
        setCurrentTime(0);
    }, [setIsPlaying, setCurrentTime]);

    const handleLoopToggle = useCallback(() => {
        setIsLooping(!isLooping);
    }, [isLooping]);

    return {
        isPlaying,
        setIsPlaying,
        currentTime,
        setCurrentTime,
        isLooping,
        setIsLooping,
        globalPlayMode,
        setGlobalPlayMode,
        handlePlayPause,
        handleStop,
        handleLoopToggle
    };
};

