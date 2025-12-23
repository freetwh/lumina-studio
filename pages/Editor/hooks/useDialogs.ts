import { useState } from 'react';

export interface ConfirmDialogState {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
}

export interface UseDialogsReturn {
    // 模板保存弹窗
    templateDialog: {
        isOpen: boolean;
        name: string;
    };
    openTemplateDialog: () => void;
    closeTemplateDialog: () => void;
    setTemplateName: (name: string) => void;
    
    // 选区保存弹窗
    selectionDialog: {
        isOpen: boolean;
        name: string;
    };
    openSelectionDialog: (defaultName: string) => void;
    closeSelectionDialog: () => void;
    setSelectionName: (name: string) => void;
    
    // 确认对话框
    confirmDialog: ConfirmDialogState;
    openConfirmDialog: (title: string, message: string, onConfirm: () => void) => void;
    closeConfirmDialog: () => void;
}

export const useDialogs = (): UseDialogsReturn => {
    // 模板保存弹窗
    const [isTemplateSaveOpen, setIsTemplateSaveOpen] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');
    
    // 选区保存弹窗
    const [isSaveSelectionOpen, setIsSaveSelectionOpen] = useState(false);
    const [newSelectionName, setNewSelectionName] = useState('');

    // 确认对话框
    const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {}
    });

    return {
        templateDialog: {
            isOpen: isTemplateSaveOpen,
            name: newTemplateName
        },
        openTemplateDialog: () => setIsTemplateSaveOpen(true),
        closeTemplateDialog: () => setIsTemplateSaveOpen(false),
        setTemplateName: setNewTemplateName,
        
        selectionDialog: {
            isOpen: isSaveSelectionOpen,
            name: newSelectionName
        },
        openSelectionDialog: (defaultName: string) => {
            setNewSelectionName(defaultName);
            setIsSaveSelectionOpen(true);
        },
        closeSelectionDialog: () => setIsSaveSelectionOpen(false),
        setSelectionName: setNewSelectionName,
        
        confirmDialog,
        openConfirmDialog: (title: string, message: string, onConfirm: () => void) => {
            setConfirmDialog({ isOpen: true, title, message, onConfirm });
        },
        closeConfirmDialog: () => {
            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
    };
};

