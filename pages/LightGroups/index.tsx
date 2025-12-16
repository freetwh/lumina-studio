
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
  const { lightGroups: groups, projects } = data;
  const { toast } = useToast();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteMessage, setDeleteMessage] = useState("");

  const handleDeleteRequest = (id: string) => {
    const affectedProjects = projects.filter(p => p.lightGroupId === id);
    if (affectedProjects.length > 0) {
        const names = affectedProjects.map(p => p.name).join(', ');
        setDeleteMessage(`警告：${names} 工程正在使用这个灯组。如果删除，这些工程也会被删除，是否确认删除？`);
    } else {
        setDeleteMessage("确定删除该灯组？此操作无法撤销。");
    }
    setDeleteId(id);
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    
    // 级联删除：删除使用此灯组的工程
    const remainingProjects = projects.filter(p => p.lightGroupId !== deleteId);
    const deletedProjectsCount = projects.length - remainingProjects.length;

    const newData = { 
          ...data,
          lightGroups: data.lightGroups.filter(g => g.id !== deleteId),
          projects: remainingProjects
    };
    save(newData);
    
    if (deletedProjectsCount > 0) {
        toast(`灯组已删除，并清理了 ${deletedProjectsCount} 个相关工程`);
    } else {
        toast("灯组已删除");
    }
    setDeleteId(null);
  };

  const openCreateDialog = () => {
      setIsDialogOpen(true);
  };

  const handleSaveGroup = (name: string, rows: number, cols: number) => {
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

    const newGroup: LightGroup = {
        id: generateId(),
        name: name,
        createdAt: Date.now(),
        nodes,
        gridConfig: { rows, cols }
    };

    const updatedGroups = [...data.lightGroups, newGroup];
    const newData = { ...data, lightGroups: updatedGroups };
    save(newData);
    setIsDialogOpen(false);
    toast("灯组已创建", "success");
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
        onDelete={handleDeleteRequest} 
      />

      <CreateGroupDialog 
        isOpen={isDialogOpen} 
        onClose={() => setIsDialogOpen(false)} 
        onSave={handleSaveGroup} 
        initialValues={null}
      />

      <ConfirmDialog 
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title="删除灯组"
        message={deleteMessage}
      />
    </div>
  );
}
