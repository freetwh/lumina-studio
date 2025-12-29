import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Keyframe, Animation } from '../../../types';
import { detectCollisionAndSnap } from '../services/collisionDetector';

const PIXELS_PER_SEC = 100;
const TRACK_HEIGHT = 40;

export interface UseKeyframeDragReturn {
    dragGhosts: Map<string, { startTime: number; trackId: number; duration: number }> | null;
    handleKeyframeMouseDown: (e: React.MouseEvent, k: Keyframe) => void;
}

interface DraggedInfo {
    id: string; // 被直接点击拖拽的关键帧 ID
    startX: number;
    startY: number;
    initialStates: Map<string, { startTime: number; trackId: number; duration: number }>;
}

/**
 * 关键帧拖拽 Hook
 * 管理时间轴上关键帧的拖拽、多选拖拽、碰撞检测和 Ghost 预览
 */
export const useKeyframeDrag = (
    currentAnimation: Animation | undefined,
    timelineZoom: number,
    selectedKeyframeIds: Set<string>,
    onKeyframesDragComplete: (updates: { id: string; startTime: number; trackId: number }[]) => void,
    onKeyframeSelect: (keyframeId: string, targetLightIds: string[], e: React.MouseEvent) => void
): UseKeyframeDragReturn => {
    const [dragGhosts, setDragGhosts] = useState<Map<string, { startTime: number; trackId: number; duration: number }> | null>(null);
    
    // 使用 Ref 追踪变动频繁的数据，供异步事件处理器使用
    const animRef = useRef(currentAnimation);
    const zoomRef = useRef(timelineZoom);
    const onCompleteRef = useRef(onKeyframesDragComplete);
    
    // 拖拽过程中的实时数据
    const dragRef = useRef<DraggedInfo | null>(null);
    const ghostsRef = useRef<Map<string, { startTime: number; trackId: number; duration: number }> | null>(null);

    useEffect(() => {
        animRef.current = currentAnimation;
        zoomRef.current = timelineZoom;
        onCompleteRef.current = onKeyframesDragComplete;
    }, [currentAnimation, timelineZoom, onKeyframesDragComplete]);

    const handleKeyframeMouseDown = useCallback((e: React.MouseEvent, k: Keyframe) => {
        e.stopPropagation();
        
        // 1. 通知外部选择逻辑
        onKeyframeSelect(k.id, k.targetLightIds, e);

        // 2. 准备拖拽状态
        const isCurrentlySelected = selectedKeyframeIds.has(k.id);
        const dragIds = isCurrentlySelected ? selectedKeyframeIds : new Set([k.id]);
        
        const initialStates = new Map<string, { startTime: number; trackId: number; duration: number }>();
        const ghosts = new Map<string, { startTime: number; trackId: number; duration: number }>();
        
        dragIds.forEach(id => {
            const kf = animRef.current?.keyframes.find(item => item.id === id);
            if (kf) {
                const state = { startTime: kf.startTime, trackId: kf.trackId, duration: kf.duration };
                initialStates.set(id, state);
                ghosts.set(id, state);
            }
        });

        const draggedInfo: DraggedInfo = {
            id: k.id,
            startX: e.clientX,
            startY: e.clientY,
            initialStates
        };
        
        dragRef.current = draggedInfo;
        ghostsRef.current = ghosts;
        setDragGhosts(new Map(ghosts));

        // 3. 定义并绑定临时事件处理器
        const handleMouseMove = (moveEvent: MouseEvent) => {
            const info = dragRef.current;
            const anim = animRef.current;
            if (!info || !anim) return;

            moveEvent.preventDefault();
            const deltaX = moveEvent.clientX - info.startX;
            const deltaY = moveEvent.clientY - info.startY;
            
            const timeDelta = (deltaX / (PIXELS_PER_SEC * zoomRef.current)) * 1000;
            const trackDelta = Math.round(deltaY / TRACK_HEIGHT);

            const newGhosts = new Map<string, { startTime: number; trackId: number; duration: number }>();
            
            const primaryInitial = info.initialStates.get(info.id);
            if (!primaryInitial) return;

            let primaryStartTime = Math.max(0, Math.floor(primaryInitial.startTime + timeDelta));
            let primaryTrackId = Math.max(0, Math.min(5, primaryInitial.trackId + trackDelta));

            // 碰撞检测（排除当前正在拖拽的所有帧）
            primaryStartTime = detectCollisionAndSnap(
                primaryStartTime,
                primaryInitial.duration,
                primaryTrackId,
                info.id,
                anim.keyframes.filter(kf => !info.initialStates.has(kf.id))
            );

            const actualTimeDelta = primaryStartTime - primaryInitial.startTime;
            const actualTrackDelta = primaryTrackId - primaryInitial.trackId;

            info.initialStates.forEach((state, id) => {
                newGhosts.set(id, {
                    startTime: Math.max(0, state.startTime + actualTimeDelta),
                    trackId: Math.max(0, Math.min(5, state.trackId + actualTrackDelta)),
                    duration: state.duration
                });
            });

            ghostsRef.current = newGhosts;
            setDragGhosts(newGhosts);
        };

        const handleMouseUp = () => {
            const finalGhosts = ghostsRef.current;
            const finalInfo = dragRef.current;

            // 立即清理状态和监听器
            dragRef.current = null;
            ghostsRef.current = null;
            setDragGhosts(null);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);

            if (finalInfo && finalGhosts) {
                const updates = Array.from(finalGhosts.entries()).map(([id, state]) => ({
                    id,
                    startTime: state.startTime,
                    trackId: state.trackId
                }));
                
                if (updates.length > 0) {
                    onCompleteRef.current(updates);
                }
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }, [selectedKeyframeIds, onKeyframeSelect]);

    // 组件卸载时确保监听器被清理
    useEffect(() => {
        return () => {
            dragRef.current = null;
            ghostsRef.current = null;
            setDragGhosts(null);
        };
    }, []);

    return {
        dragGhosts,
        handleKeyframeMouseDown
    };
};
