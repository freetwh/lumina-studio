import { useState, useEffect, useCallback } from 'react';
import { Keyframe, Animation, Project } from '../../../types';
import { detectCollisionAndSnap } from '../services/collisionDetector';
import { calculateDuration } from '../services/animationCalculator';

const PIXELS_PER_SEC = 100;
const TRACK_HEIGHT = 40;

export interface UseKeyframeDragReturn {
    dragGhost: { startTime: number; trackId: number; duration: number } | null;
    handleKeyframeMouseDown: (e: React.MouseEvent, k: Keyframe) => void;
}

interface DraggedKeyframe {
    id: string;
    startX: number;
    startY: number;
    initialStartTime: number;
    initialTrackId: number;
    duration: number;
}

/**
 * 关键帧拖拽 Hook
 * 管理时间轴上关键帧的拖拽、碰撞检测和 Ghost 预览
 */
export const useKeyframeDrag = (
    currentAnimation: Animation | undefined,
    timelineZoom: number,
    onKeyframeDragComplete: (keyframeId: string, newStartTime: number, newTrackId: number) => void,
    onKeyframeSelect: (keyframeId: string, targetLightIds: string[]) => void
): UseKeyframeDragReturn => {
    const [draggedKeyframe, setDraggedKeyframe] = useState<DraggedKeyframe | null>(null);
    const [dragGhost, setDragGhost] = useState<{ startTime: number; trackId: number; duration: number } | null>(null);

    const handleKeyframeMouseDown = useCallback((e: React.MouseEvent, k: Keyframe) => {
        e.stopPropagation();
        setDraggedKeyframe({
            id: k.id,
            startX: e.clientX,
            startY: e.clientY,
            initialStartTime: k.startTime,
            initialTrackId: k.trackId,
            duration: k.duration
        });
        setDragGhost({
            startTime: k.startTime,
            trackId: k.trackId,
            duration: k.duration
        });
        onKeyframeSelect(k.id, k.targetLightIds);
    }, [onKeyframeSelect]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (draggedKeyframe && currentAnimation) {
                e.preventDefault();
                const deltaX = e.clientX - draggedKeyframe.startX;
                const deltaY = e.clientY - draggedKeyframe.startY;
                
                const timeDelta = (deltaX / (PIXELS_PER_SEC * timelineZoom)) * 1000;
                let newStartTime = Math.max(0, Math.floor(draggedKeyframe.initialStartTime + timeDelta));
                
                const trackDelta = Math.round(deltaY / TRACK_HEIGHT);
                const newTrackId = Math.max(0, Math.min(5, draggedKeyframe.initialTrackId + trackDelta));

                const duration = draggedKeyframe.duration;
                
                // 使用碰撞检测服务
                newStartTime = detectCollisionAndSnap(
                    newStartTime,
                    duration,
                    newTrackId,
                    draggedKeyframe.id,
                    currentAnimation.keyframes
                );

                setDragGhost({
                    startTime: newStartTime,
                    trackId: newTrackId,
                    duration: duration
                });
            }
        };

        const handleMouseUp = () => {
            if (draggedKeyframe && dragGhost) {
                onKeyframeDragComplete(draggedKeyframe.id, dragGhost.startTime, dragGhost.trackId);
            }
            setDraggedKeyframe(null);
            setDragGhost(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [draggedKeyframe, dragGhost, currentAnimation, timelineZoom, onKeyframeDragComplete]);

    return {
        dragGhost,
        handleKeyframeMouseDown
    };
};

