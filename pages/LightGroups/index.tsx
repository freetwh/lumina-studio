
import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { generateId } from '../../utils';
import { LightGroup } from '../../types';
import { CreateGroupDialog } from './components/CreateGroupDialog';
import { LightGroupList } from './components/LightGroupList';
import { useStorage } from '../../hooks/useStorage';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useToast } from '../../components/ui/toast-context';

export default function LightGroups() {
  const { data, save } = useStorage();
  const { lightGroups: groups } = data;
  const { toast } = useToast();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<LightGroup | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const confirmDelete = () => {
    if (!deleteId) return;
    const newData = { 
          ...data,
          lightGroups: data.lightGroups.filter(g => g.id !== deleteId)
    };
    save(newData);
    toast("灯组已删除");
    setDeleteId(null);
  };

  const openCreateDialog = () => {
      setEditingGroup(null);
      setIsDialogOpen(true);
  };

  const openEditDialog = (group: LightGroup) => {
      setEditingGroup(group);
      setIsDialogOpen(true);
  };

  const handleSaveGroup = (name: string, rows: number, cols: number) => {
    const isEditing = !!editingGroup;
    let newGroup: LightGroup;

    // 如果是编辑模式，且行列数没变，只更新名字，不重置节点
    if (isEditing && editingGroup.gridConfig && editingGroup.gridConfig.rows === rows && editingGroup.gridConfig.cols === cols) {
        newGroup = {
            ...editingGroup,
            name,
            gridConfig: { rows, cols }
        };
    } else {
        // 创建新节点布局 (新建 或 编辑时修改了尺寸)
        const nodes = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const x = cols > 1 ? (c / (cols - 1)) * 100 : 50;
                const y = rows > 1 ? (r / (rows - 1)) * 100 : 50;
                
                nodes.push({
                    id: `node-${Date.now()}-${r}-${c}`,
                    x,
                    y,
                    brightness: 1,
                    color: '#ffffff'
                });
            }
        }

        newGroup = {
            id: isEditing ? editingGroup.id : generateId(),
            name: name,
            createdAt: isEditing ? editingGroup.createdAt : Date.now(),
            nodes,
            gridConfig: { rows, cols }
        };
    }

    // Immutable update
    let updatedGroups;
    if (isEditing) {
        updatedGroups = data.lightGroups.map(g => g.id === newGroup.id ? newGroup : g);
    } else {
        updatedGroups = [...data.lightGroups, newGroup];
    }

    const newData = { ...data, lightGroups: updatedGroups };
    save(newData);
    setIsDialogOpen(false);
    setEditingGroup(null);
    toast(isEditing ? "灯组已更新" : "灯组已创建", "success");
  };

  return (
    <div className="container mx-auto p-6">
       <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight">灯组管理</h1>
        <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" /> 新建灯组
        </Button>
      </div>

      <LightGroupList 
        groups={groups} 
        onDelete={(id) => setDeleteId(id)} 
        onEdit={openEditDialog}
      />

      <CreateGroupDialog 
        isOpen={isDialogOpen} 
        onClose={() => setIsDialogOpen(false)} 
        onSave={handleSaveGroup} 
        initialValues={editingGroup ? { 
            name: editingGroup.name, 
            rows: editingGroup.gridConfig?.rows || 8, 
            cols: editingGroup.gridConfig?.cols || 8 
        } : null}
      />

      <ConfirmDialog 
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title="删除灯组"
        message="确定删除该灯组？使用了该灯组的工程可能会损坏。"
      />
    </div>
  );
}
