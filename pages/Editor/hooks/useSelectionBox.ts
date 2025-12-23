import { useState, useRef, useCallback, useEffect } from 'react';
import { LightGroup } from '../../../types';

export interface UseSelectionBoxReturn {
    selectionBox: { x: number; y: number; w: number; h: number } | null;
    selectedLightIds: Set<string>;
    setSelectedLightIds: (ids: Set<string>) => void;
    handlePreviewMouseDown: (e: React.MouseEvent, previewRef: React.RefObject<HTMLDivElement>, isSpacePressed: boolean) => void;
    handleLightClick: (e: React.MouseEvent, id: string) => void;
}

/**
 * 框选逻辑 Hook
 * 管理预览区域的框选和灯珠选择
 */
export const useSelectionBox = (lightGroup: LightGroup | null): UseSelectionBoxReturn => {
    const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
    const [selectedLightIds, setSelectedLightIds] = useState<Set<string>>(new Set());
    const selectionStartRef = useRef<{ x: number; y: number } | null>(null);
    const initialSelectionRef = useRef<Set<string>>(new Set());
    const previewRefCache = useRef<React.RefObject<HTMLDivElement> | null>(null);

    const handlePreviewMouseDown = useCallback((
        e: React.MouseEvent,
        previewRef: React.RefObject<HTMLDivElement>,
        isSpacePressed: boolean
    ) => {
        if (!previewRef.current || isSpacePressed) return;
        
        previewRefCache.current = previewRef;
        
        // 防止 Alt 键触发浏览器默认行为
        if (e.altKey) e.preventDefault();

        // 获取当前视口的实际边界（包含缩放和平移）
        const rect = previewRef.current.getBoundingClientRect();
        
        const internalWidth = parseFloat(previewRef.current.style.width) || 1;
        const internalHeight = parseFloat(previewRef.current.style.height) || 1;
        
        const scaleX = rect.width / internalWidth;
        const scaleY = rect.height / internalHeight;
        
        // 计算相对于内部坐标系的位置
        const startX = (e.clientX - rect.left) / scaleX;
        const startY = (e.clientY - rect.top) / scaleY;
        
        selectionStartRef.current = { x: startX, y: startY };
        setSelectionBox({ x: startX, y: startY, w: 0, h: 0 });

        if (e.shiftKey || e.altKey) {
            initialSelectionRef.current = new Set(selectedLightIds);
        } else {
            initialSelectionRef.current = new Set();
            setSelectedLightIds(new Set());
        }
    }, [selectedLightIds]);

    const handleLightClick = useCallback((e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (e.altKey) e.preventDefault();
        
        setSelectedLightIds(prev => {
            const next = new Set(prev);
            if (e.shiftKey) {
                next.add(id);
            } else if (e.altKey) {
                next.delete(id);
            } else {
                return new Set([id]);
            }
            return next;
        });
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (selectionStartRef.current && previewRefCache.current?.current && lightGroup) {
                const previewRef = previewRefCache.current;
                if (!previewRef.current) return;

                const rect = previewRef.current.getBoundingClientRect();
                
                const internalWidth = parseFloat(previewRef.current.style.width) || 1;
                const internalHeight = parseFloat(previewRef.current.style.height) || 1;
                
                const scaleX = rect.width / internalWidth;
                const scaleY = rect.height / internalHeight;

                const localX = (e.clientX - rect.left) / scaleX;
                const localY = (e.clientY - rect.top) / scaleY;

                const startX = selectionStartRef.current.x;
                const startY = selectionStartRef.current.y;
                
                const newBox = {
                    x: Math.min(startX, localX),
                    y: Math.min(startY, localY),
                    w: Math.abs(localX - startX),
                    h: Math.abs(localY - startY)
                };
                
                setSelectionBox(newBox);
                
                const boxSelectedIds = new Set<string>();
                
                const contentWidth = internalWidth;
                const contentHeight = internalHeight;

                lightGroup.nodes.forEach(node => {
                    const nodeX = (node.x / 100) * contentWidth;
                    const nodeY = (node.y / 100) * contentHeight;
                    
                    if (nodeX >= newBox.x && nodeX <= newBox.x + newBox.w &&
                        nodeY >= newBox.y && nodeY <= newBox.y + newBox.h) {
                        boxSelectedIds.add(node.id);
                    }
                });

                const finalSelection = new Set(initialSelectionRef.current);
                if (e.shiftKey) {
                    boxSelectedIds.forEach(id => finalSelection.add(id));
                    setSelectedLightIds(finalSelection);
                } else if (e.altKey) {
                    boxSelectedIds.forEach(id => finalSelection.delete(id));
                    setSelectedLightIds(finalSelection);
                } else {
                    setSelectedLightIds(boxSelectedIds);
                }
            }
        };

        const handleMouseUp = () => {
            if (selectionStartRef.current) {
                selectionStartRef.current = null;
                setSelectionBox(null);
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [lightGroup]);

    return {
        selectionBox,
        selectedLightIds,
        setSelectedLightIds,
        handlePreviewMouseDown,
        handleLightClick
    };
};

