import { useEffect } from 'react';

export interface UseKeyboardShortcutsProps {
    onUndo: () => void;
    onRedo: () => void;
    onDelete: () => void;
    onSpacePress: (pressed: boolean) => void;
}

export const useKeyboardShortcuts = ({
    onUndo,
    onRedo,
    onDelete,
    onSpacePress
}: UseKeyboardShortcutsProps): void => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl/Cmd + Z: 撤销
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                onUndo();
            }
            
            // Ctrl/Cmd + Y: 重做
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                onRedo();
            }
            
            // Backspace: 删除
            if (e.key === 'Backspace') {
                // 忽略在输入框内的删除
                if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
                onDelete();
            }
            
            // Space: 画布拖拽
            if (e.code === 'Space' && !e.repeat && !(e.target instanceof HTMLInputElement)) {
                e.preventDefault(); 
                onSpacePress(true);
            }
        };
        
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                onSpacePress(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [onUndo, onRedo, onDelete, onSpacePress]);
};

