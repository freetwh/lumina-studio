import { useState, useRef, useCallback, useEffect } from 'react';
import { Animation, Keyframe } from '../../../types';

export interface UseTimelineSelectionProps {
    currentAnimation: Animation | undefined;
    zoom: number;
    pixelsPerSec: number;
    trackHeight: number;
    selectedKeyframeIds: Set<string>;
    onSelectionChange: (ids: Set<string>) => void;
}

export interface UseTimelineSelectionReturn {
    selectionBox: { x: number; y: number; w: number; h: number } | null;
    handleTimelineMouseDown: (e: React.MouseEvent, timelineRef: React.RefObject<HTMLDivElement>) => void;
}

/**
 * 时间轴框选逻辑 Hook
 * 管理时间轴区域的关键帧多选
 */
export const useTimelineSelection = ({
    currentAnimation,
    zoom,
    pixelsPerSec,
    trackHeight,
    selectedKeyframeIds,
    onSelectionChange
}: UseTimelineSelectionProps): UseTimelineSelectionReturn => {
    const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
    const selectionStartRef = useRef<{ x: number; y: number; scrollLeft: number } | null>(null);
    const timelineRefCache = useRef<React.RefObject<HTMLDivElement> | null>(null);
    const initialSelectionRef = useRef<Set<string>>(new Set());

    // 使用 Ref 追踪变动频繁的依赖
    const animRef = useRef(currentAnimation);
    const zoomRef = useRef(zoom);
    const onSelectionChangeRef = useRef(onSelectionChange);
    const pixelsPerSecRef = useRef(pixelsPerSec);
    const trackHeightRef = useRef(trackHeight);

    useEffect(() => {
        animRef.current = currentAnimation;
        zoomRef.current = zoom;
        onSelectionChangeRef.current = onSelectionChange;
        pixelsPerSecRef.current = pixelsPerSec;
        trackHeightRef.current = trackHeight;
    }, [currentAnimation, zoom, onSelectionChange, pixelsPerSec, trackHeight]);

    const handleTimelineMouseDown = useCallback((
        e: React.MouseEvent,
        timelineRef: React.RefObject<HTMLDivElement>
    ) => {
        // 如果点击的是关键帧，不触发框选（关键帧自己会处理 mousedown）
        if ((e.target as HTMLElement).closest('.keyframe-item')) return;
        if (!timelineRef.current) return;

        timelineRefCache.current = timelineRef;
        const rect = timelineRef.current.getBoundingClientRect();
        const scrollLeft = timelineRef.current.scrollLeft;
        
        // 计算相对于 timeline 内容区域的坐标
        const startX = e.clientX - rect.left + scrollLeft;
        const startY = e.clientY - rect.top;

        selectionStartRef.current = { x: startX, y: startY, scrollLeft };
        setSelectionBox({ x: startX, y: startY, w: 0, h: 0 });

        if (e.shiftKey) {
            initialSelectionRef.current = new Set(selectedKeyframeIds);
        } else {
            initialSelectionRef.current = new Set();
            onSelectionChangeRef.current(new Set());
        }

        const handleMouseMove = (moveEvent: MouseEvent) => {
            if (selectionStartRef.current && timelineRefCache.current?.current && animRef.current) {
                const timeline = timelineRefCache.current.current;
                const rect = timeline.getBoundingClientRect();
                const scrollLeft = timeline.scrollLeft;
                
                const currentX = moveEvent.clientX - rect.left + scrollLeft;
                const currentY = moveEvent.clientY - rect.top;

                const startX = selectionStartRef.current.x;
                const startY = selectionStartRef.current.y;

                const newBox = {
                    x: Math.min(startX, currentX),
                    y: Math.min(startY, currentY),
                    w: Math.abs(currentX - startX),
                    h: Math.abs(currentY - startY)
                };

                setSelectionBox(newBox);

                // 计算哪些关键帧在框内
                const boxSelectedIds = new Set<string>();
                
                animRef.current.keyframes.forEach(kf => {
                    const kfLeft = (kf.startTime / 1000) * pixelsPerSecRef.current * zoomRef.current;
                    const kfRight = ((kf.startTime + kf.duration) / 1000) * pixelsPerSecRef.current * zoomRef.current;
                    
                    const offsetTop = 24 + 8;
                    const kfTop = kf.trackId * trackHeightRef.current + offsetTop;
                    const kfBottom = kfTop + trackHeightRef.current;

                    const isIntersecting = !(
                        newBox.x > kfRight || 
                        newBox.x + newBox.w < kfLeft || 
                        newBox.y > kfBottom || 
                        newBox.y + newBox.h < kfTop
                    );

                    if (isIntersecting) {
                        boxSelectedIds.add(kf.id);
                    }
                });

                const finalSelection = new Set(initialSelectionRef.current);
                if (moveEvent.shiftKey) {
                    boxSelectedIds.forEach(id => finalSelection.add(id));
                    onSelectionChangeRef.current(finalSelection);
                } else {
                    onSelectionChangeRef.current(boxSelectedIds);
                }
            }
        };

        const handleMouseUp = () => {
            selectionStartRef.current = null;
            setSelectionBox(null);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }, [selectedKeyframeIds]);

    return {
        selectionBox,
        handleTimelineMouseDown
    };
};

