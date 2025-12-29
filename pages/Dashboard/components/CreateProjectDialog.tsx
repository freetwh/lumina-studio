import React, { useState, useEffect } from 'react';
import * as z from 'zod';
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

const formSchema = z.object({
  name: z.string().min(1, { message: '请输入工程名称' }).trim(),
  baseType: z.enum(['group', 'template']),
  baseId: z.string().min(1, { message: '请选择灯组或模板' }),
});

type FormData = z.infer<typeof formSchema>;
type FormErrors = Partial<Record<keyof FormData, string>>;

export const CreateProjectDialog: React.FC<CreateProjectDialogProps> = ({
  isOpen,
  onClose,
  onCreate,
  lightGroups,
  templates
}) => {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    baseType: 'group',
    baseId: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  // 当切换 baseType 时，重置 baseId
  useEffect(() => {
    setFormData(prev => ({...prev, baseId: ''}));
    setErrors(prev => ({...prev, baseId: undefined}));
  }, [formData.baseType]);

  // 重置表单当对话框关闭时
  useEffect(() => {
    if (!isOpen) {
      setFormData({ name: '', baseType: 'group', baseId: '' });
      setErrors({});
    }
  }, [isOpen]);

  const handleSubmit = () => {
    try {
      const validated = formSchema.parse(formData);
      onCreate(validated.name, validated.baseType, validated.baseId);
      setFormData({ name: '', baseType: 'group', baseId: '' });
      setErrors({});
      onClose();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: FormErrors = {};
        error.issues.forEach(issue => {
          const path = issue.path[0] as keyof FormData;
          newErrors[path] = issue.message;
        });
        setErrors(newErrors);
      }
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
              <Button onClick={handleSubmit}>创建</Button>
          </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="project-name">
            工程名称 <span className="text-destructive">*</span>
          </Label>
          <Input
            id="project-name"
            placeholder="我的灯光秀"
            value={formData.name}
            onChange={(e) => {
              setFormData(prev => ({ ...prev, name: e.target.value }));
              setErrors(prev => ({ ...prev, name: undefined }));
            }}
            className={errors.name ? 'border-destructive focus-visible:ring-destructive' : ''}
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <Label>初始内容</Label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="group"
                checked={formData.baseType === 'group'}
                onChange={() => setFormData(prev => ({ ...prev, baseType: 'group' }))}
              />
              选择灯组
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="template"
                checked={formData.baseType === 'template'}
                onChange={() => setFormData(prev => ({ ...prev, baseType: 'template' }))}
              />
              选择模板
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="base-select">
            {formData.baseType === 'group' ? '选择灯组' : '选择模板'} <span className="text-destructive">*</span>
          </Label>
          <select
            id="base-select"
            className={`w-full h-10 rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              errors.baseId ? 'border-destructive focus:ring-destructive' : 'border-input'
            }`}
            value={formData.baseId}
            onChange={(e) => {
              setFormData(prev => ({ ...prev, baseId: e.target.value }));
              setErrors(prev => ({ ...prev, baseId: undefined }));
            }}
          >
            <option value="">请选择...</option>
            {formData.baseType === 'group'
              ? lightGroups.map(lg => (
                  <option key={lg.id} value={lg.id}>
                    {lg.name} ({lg.nodes.length} 灯珠)
                  </option>
                ))
              : templates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))
            }
          </select>
          {errors.baseId && (
            <p className="text-sm text-destructive">{errors.baseId}</p>
          )}
        </div>
      </div>
    </Dialog>
  );
};