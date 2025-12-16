import React, { useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Dialog } from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { LightGroup, Template } from '../../../types';

interface CreateProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, baseType: 'group' | 'template', baseId: string) => void;
  lightGroups: LightGroup[];
  templates: Template[];
}

export const CreateProjectDialog: React.FC<CreateProjectDialogProps> = ({
  isOpen,
  onClose,
  onCreate,
  lightGroups,
  templates
}) => {
  const [name, setName] = useState('');
  const [baseType, setBaseType] = useState<'group' | 'template'>('group');
  const [baseId, setBaseId] = useState('');

  const handleCreate = () => {
    if (name && baseId) {
      onCreate(name, baseType, baseId);
      setName('');
      setBaseId('');
    }
  };

  return (
    <Dialog 
      isOpen={isOpen} 
      onClose={onClose} 
      title="新建工程"
      footer={
          <>
              <Button variant="ghost" onClick={onClose}>取消</Button>
              <Button onClick={handleCreate}>创建</Button>
          </>
      }
    >
      <div className="space-y-4">
          <div className="space-y-2">
              <Label>工程名称</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="我的灯光秀" />
          </div>
          
          <div className="space-y-2">
              <Label>初始内容</Label>
              <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                      <input type="radio" name="baseType" checked={baseType === 'group'} onChange={() => setBaseType('group')} />
                      选择灯组
                  </label>
                  <label className="flex items-center gap-2">
                      <input type="radio" name="baseType" checked={baseType === 'template'} onChange={() => setBaseType('template')} />
                      选择模板
                  </label>
              </div>
          </div>

          <div className="space-y-2">
              <Label>{baseType === 'group' ? '选择灯组' : '选择模板'}</Label>
              <select 
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={baseId}
                  onChange={e => setBaseId(e.target.value)}
              >
                  <option value="">请选择...</option>
                  {baseType === 'group' 
                      ? lightGroups.map(lg => <option key={lg.id} value={lg.id}>{lg.name} ({lg.nodes.length} 灯珠)</option>)
                      : templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)
                  }
              </select>
          </div>
      </div>
    </Dialog>
  );
};