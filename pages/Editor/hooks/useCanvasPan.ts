import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseCanvasPanReturn {
    pan: { x: number; y: number };
    isPanning: boolean;
    isSpacePressed: boolean;
    setIsSpacePressed: (pressed: boolean) => void;
    handleMouseDown: (e: React.MouseEvent) => void;
}

/**
 * 画布平移 Hook
 * 管理空格键拖拽画布的状态和逻辑
 */
export const useCanvasPan = (): UseCanvasPanReturn => {
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isSpacePressed, setIsSpacePressed] = useState(false);
    const [isPanning, setIsPanning] = useState(false);
    const panStartRef = useRef<{ x: number; y: number } | null>(null);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (isSpacePressed) {
            setIsPanning(true);
            panStartRef.current = { x: e.clientX, y: e.clientY };
        }
    }, [isSpacePressed]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isPanning && panStartRef.current) {
                const dx = e.clientX - panStartRef.current.x;
                const dy = e.clientY - panStartRef.current.y;
                setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
                panStartRef.current = { x: e.clientX, y: e.clientY };
            }
        };

        const handleMouseUp = () => {
            if (isPanning) {
                setIsPanning(false);
                panStartRef.current = null;
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isPanning]);

    // 当空格键释放时，停止拖拽
    useEffect(() => {
        if (!isSpacePressed) {
            setIsPanning(false);
        }
    }, [isSpacePressed]);

    return {
        pan,
        isPanning,
        isSpacePressed,
        setIsSpacePressed,
        handleMouseDown
    };
};

