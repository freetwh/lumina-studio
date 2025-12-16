
import React, { useState, useEffect } from 'react';
import { Button } from '../../../components/ui/button';
import { Dialog } from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';

interface CreateGroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, rows: number, cols: number) => void;
  initialValues?: { name: string; rows: number; cols: number } | null;
}

export const CreateGroupDialog: React.FC<CreateGroupDialogProps> = ({ isOpen, onClose, onSave, initialValues }) => {
  const [name, setName] = useState('');
  const [rows, setRows] = useState(8);
  const [cols, setCols] = useState(8);

  useEffect(() => {
    if (isOpen) {
      if (initialValues) {
        setName(initialValues.name);
        setRows(initialValues.rows);
        setCols(initialValues.cols);
      } else {
        setName('');
        setRows(8);
        setCols(8);
      }
    }
  }, [isOpen, initialValues]);

  const handleSave = () => {
    if (name) {
      onSave(name, rows, cols);
    }
  };

  return (
    <Dialog 
      isOpen={isOpen} 
      onClose={onClose} 
      title={initialValues ? "编辑灯组" : "新建灯组"}
      footer={
          <>
            <Button variant="ghost" onClick={onClose}>取消</Button>
            <Button onClick={handleSave}>{initialValues ? "保存" : "创建"}</Button>
          </>
      }
    >
        <div className="space-y-4">
          <div className="space-y-2">
              <Label>灯组名称</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="矩阵 16x8" />
          </div>
          <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                  <Label>行数 (Rows)</Label>
                  <Input type="number" value={rows} onChange={e => setRows(Number(e.target.value))} min={1} max={64} />
              </div>
              <div className="space-y-2">
                  <Label>列数 (Columns)</Label>
                  <Input type="number" value={cols} onChange={e => setCols(Number(e.target.value))} min={1} max={64} />
              </div>
          </div>
          {initialValues && (
              <p className="text-xs text-yellow-600">
                  注意：修改行数或列数将重置所有灯珠位置。仅修改名称不会影响布局。
              </p>
          )}
        </div>
    </Dialog>
  );
};
