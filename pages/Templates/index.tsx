
import React, { useState } from 'react';
import { Upload, Trash2, Wand2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { readFileAsJson } from '../../utils';
import { useStorage } from '../../hooks/useStorage';
import { useToast } from '../../components/ui/toast-context';
import { ConfirmDialog } from '../../components/ConfirmDialog';

export default function Templates() {
  const { data, save } = useStorage();
  const { templates } = data;
  const { toast } = useToast();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const confirmDelete = () => {
    if (!deleteId) return;
    const newData = { ...data };
    newData.templates = newData.templates.filter(t => t.id !== deleteId);
    save(newData);
    toast("模板已删除");
    setDeleteId(null);
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
        const json = await readFileAsJson(file);
        const newData = { ...data };
        if (Array.isArray(json)) {
            newData.templates = [...newData.templates, ...json];
        } else {
            if (!json.id) json.id = Math.random().toString();
            newData.templates.push(json);
        }
        save(newData);
        toast("模板导入成功", "success");
    } catch(e) {
        toast("导入失败：文件格式错误", "error");
    }
  };

  return (
    <div className="container mx-auto p-6">
       <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight">模板库</h1>
        <div className="relative">
             <input type="file" id="importTemp" className="hidden" accept=".json" onChange={handleImport} />
            <Button variant="outline" onClick={() => document.getElementById('importTemp')?.click()}>
                <Upload className="mr-2 h-4 w-4" /> 导入模板
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {templates.map(tpl => (
             <Card key={tpl.id}>
             <CardHeader>
                 <CardTitle className="flex justify-between items-center text-base">
                     {tpl.name}
                     <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDeleteId(tpl.id)}>
                         <Trash2 size={14} />
                     </Button>
                 </CardTitle>
             </CardHeader>
             <CardContent>
                <div className="h-24 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-md flex items-center justify-center">
                    <Wand2 className="text-primary/50" />
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                    {tpl.keyframes.length} 关键帧
                </div>
             </CardContent>
         </Card>
        ))}
      </div>

      <ConfirmDialog 
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title="删除模板"
        message="确定要删除这个模板吗？"
      />
    </div>
  );
}
