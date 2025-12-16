
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Upload } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { generateId, readFileAsJson } from '../../utils';
import { Project, LightGroup, Template } from '../../types';
import { CreateProjectDialog } from './components/CreateProjectDialog';
import { ProjectList } from './components/ProjectList';
import { useStorage } from '../../hooks/useStorage';
import { useToast } from '../../components/ui/toast-context';
import { ConfirmDialog } from '../../components/ConfirmDialog';

export default function Dashboard() {
  const navigate = useNavigate();
  const { data, save } = useStorage();
  const { projects, lightGroups, templates } = data;
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
  // Confirm Dialog State
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // 处理创建新工程的逻辑
  const handleCreateProject = (name: string, baseType: 'group' | 'template', baseId: string) => {
    let newProject: Project;

    if (baseType === 'group') {
      // 基于灯组创建空白工程
      newProject = {
        id: generateId(),
        name: name,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lightGroupId: baseId,
        animations: [{ id: generateId(), name: '主动画', keyframes: [], duration: 5000 }]
      };
    } else {
        // 基于模板创建工程
        const template = templates.find(t => t.id === baseId);
        if (!template) return;
        const targetGroupId = template.lightGroupId || lightGroups[0]?.id;
        newProject = {
            id: generateId(),
            name: name,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            lightGroupId: targetGroupId,
            animations: [{ 
                id: generateId(), 
                name: '主动画', 
                keyframes: template.keyframes.map(k => ({...k, id: generateId()})),
                duration: 5000 
            }]
        };
    }

    // 克隆并更新数据
    const newData = { ...data };
    newData.projects.push(newProject);
    save(newData);

    setIsCreateOpen(false);
    toast("工程创建成功", "success");
    navigate(`/editor/${newProject.id}`);
  };

  const confirmDelete = () => {
      if (!deleteId) return;
      const newData = { ...data };
      newData.projects = newData.projects.filter(p => p.id !== deleteId);
      save(newData);
      toast("工程已删除");
      setDeleteId(null);
  };

  // 处理文件导入逻辑
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
        const json = await readFileAsJson(file);
        const newData = { ...data };
        
        let importCount = 0;
        // 处理完整备份导入 (包含工程、灯组、模板)
        if (json.projects && Array.isArray(json.projects)) {
             // 合并工程
             const newProjects = json.projects.filter((p: Project) => !newData.projects.some(dp => dp.id === p.id));
             newData.projects.push(...newProjects);
             importCount += newProjects.length;

             // 合并灯组 (工程运行所必需)
             if (json.lightGroups && Array.isArray(json.lightGroups)) {
                 const newGroups = json.lightGroups.filter((g: LightGroup) => !newData.lightGroups.some(dg => dg.id === g.id));
                 newData.lightGroups.push(...newGroups);
             }

             // 合并模板
             if (json.templates && Array.isArray(json.templates)) {
                 const newTemplates = json.templates.filter((t: Template) => !newData.templates.some(dt => dt.id === t.id));
                 newData.templates.push(...newTemplates);
             }
        } 
        // 处理旧版/数组导入 (仅工程)
        else if (Array.isArray(json)) {
            const newProjects = json.filter((p: Project) => !newData.projects.some(dp => dp.id === p.id));
            newData.projects.push(...newProjects);
            importCount += newProjects.length;
        } 
        // 处理单个工程对象
        else if (json.id && json.name) {
             if (!newData.projects.some(p => p.id === json.id)) {
                 newData.projects.push(json);
                 importCount = 1;
             }
        }

        save(newData);
        toast(`成功导入 ${importCount} 个工程`, "success");
        
        // 重置 input，允许重复导入同名文件
        e.target.value = '';
    } catch (err) {
        console.error(err);
        toast('文件格式无效或已损坏', 'error');
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight">工程列表</h1>
        <div className="flex gap-2">
            <div className="relative">
                <input type="file" id="importProject" className="hidden" accept=".json" onChange={handleImport} />
                <Button variant="outline" onClick={() => document.getElementById('importProject')?.click()}>
                    <Upload className="mr-2 h-4 w-4" /> 导入
                </Button>
            </div>
            <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> 创建工程
            </Button>
        </div>
      </div>

      <ProjectList 
        projects={projects} 
        onOpen={(id) => navigate(`/editor/${id}`)} 
        onDelete={(id) => setDeleteId(id)} 
      />

      <CreateProjectDialog 
        isOpen={isCreateOpen} 
        onClose={() => setIsCreateOpen(false)} 
        onCreate={handleCreateProject}
        lightGroups={lightGroups}
        templates={templates}
      />
      
      <ConfirmDialog 
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title="删除工程"
        message="确定要删除这个工程吗？此操作无法撤销。"
      />
    </div>
  );
}
