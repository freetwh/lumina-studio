
import React from 'react';
import { Dialog } from './ui/dialog';
import { Button } from './ui/button';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message,
  confirmText = "确定",
  cancelText = "取消",
  variant = 'destructive'
}) => {
  return (
    <Dialog 
      isOpen={isOpen} 
      onClose={onClose} 
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{cancelText}</Button>
          <Button variant={variant} onClick={() => { onConfirm(); onClose(); }}>{confirmText}</Button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">{message}</p>
    </Dialog>
  );
};
