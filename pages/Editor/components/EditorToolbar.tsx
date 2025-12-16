import React from 'react';
import { Save, Download, Home } from 'lucide-react';
import { Button } from '../../../components/ui/button';

interface EditorToolbarProps {
  projectName?: string;
  onBack: () => void;
  onSaveTemplate: () => void;
  onExport: () => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({ projectName, onBack, onSaveTemplate, onExport }) => {
  return (
    <div className="h-12 border-b flex items-center justify-between px-4 bg-card shrink-0">
        <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onBack}>
                <Home className="w-4 h-4 mr-2" />
                返回
            </Button>
            <span className="font-semibold">{projectName}</span>
        </div>
        <div className="flex items-center gap-2">
             <Button variant="ghost" size="sm" onClick={onSaveTemplate}>
                 <Save className="w-4 h-4 mr-2" /> 存为模板
             </Button>
             <Button variant="ghost" size="sm" onClick={onExport}>
                 <Download className="w-4 h-4 mr-2" /> 导出
             </Button>
        </div>
    </div>
  );
};