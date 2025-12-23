/**
 * Editor - 灯效编辑器主组件
 * 
 * 职责：
 * 1. 管理核心业务状态（project, selectedAnimationId, currentTime, selectedLightIds）
 * 2. 组合子组件
 * 3. 协调各个业务 Hook
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useToast } from '../../components/ui/toast-context';
import { ConfirmDialog } from '../../components/ConfirmDialog';

// 子组件
import { EditorToolbar } from './components/EditorToolbar';
import { AnimationLibrary } from './components/AnimationLibrary';
import { PreviewArea } from './components/PreviewArea';
import { Inspector } from './components/Inspector';
import { Timeline } from './components/Timeline';

// 业务 Hooks
import { useProjectData } from './hooks/useProjectData';
import { useDialogs } from './hooks/useDialogs';
import { useAnimationPlayback } from './hooks/useAnimationPlayback';
import { useSelectionOperations } from './hooks/useSelectionOperations';
import { useKeyframeOperations } from './hooks/useKeyframeOperations';
import { useTemplateOperations } from './hooks/useTemplateOperations';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

export default function Editor() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // 数据层
  const { project, lightGroup, templates, updateProject, undo, redo, canUndo, canRedo } = useProjectData(projectId);
  
  // 核心状态
  const [selectedAnimationId, setSelectedAnimationId] = useState<string>('');
  const [selectedLightIds, setSelectedLightIds] = useState<Set<string>>(new Set());
  const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>(null);

  // 弹窗管理
  const {
      templateDialog,
      openTemplateDialog,
      closeTemplateDialog,
      setTemplateName,
      selectionDialog,
      openSelectionDialog,
      closeSelectionDialog,
      setSelectionName,
      confirmDialog,
      openConfirmDialog,
      closeConfirmDialog
  } = useDialogs();

  // 派生数据
  const currentAnimation = useMemo(() => {
      return project?.animations.find(a => a.id === selectedAnimationId);
  }, [project, selectedAnimationId]);

  const currentKeyframe = useMemo(() => {
      return currentAnimation?.keyframes.find(k => k.id === selectedKeyframeId);
  }, [currentAnimation, selectedKeyframeId]);

  // 播放控制
  const {
      isPlaying,
      currentTime,
      setCurrentTime,
      isLooping,
      handlePlayPause,
      handleStop,
      handleLoopToggle
  } = useAnimationPlayback({
      project,
      currentAnimation,
      selectedAnimationId,
      setSelectedAnimationId
  });

  // 关键帧操作
  const {
    handleAddKeyframe,
    handleUpdateKeyframe,
    handleDeleteKeyframe,
    handleDuplicateKeyframe,
  } = useKeyframeOperations({
      project,
      currentAnimation,
      selectedAnimationId,
      currentTime,
      selectedLightIds,
      selectedKeyframeId,
      updateProject,
      setSelectedKeyframeId,
      toast
  });

  // 选区操作
  const {
      handleSaveSelection,
      handleConfirmSaveSelection,
      handleRestoreSelection,
      handleDeleteSelection
  } = useSelectionOperations({
      project,
      selectedLightIds,
      setSelectedLightIds,
      updateProject,
      openSelectionDialog,
      openConfirmDialog,
      toast
  });

  // 模板操作
  const {
      localTemplates,
      handleSaveAnimAsTemplate,
      handleSaveAsTemplate,
      handleApplyTemplate
  } = useTemplateOperations({
      project,
      currentAnimation,
      selectedAnimationId,
      templates,
      updateProject,
      setCurrentTime,
      toast
  });

  // 关键帧选择回调
  const handleKeyframeSelect = (keyframeId: string, lightIds: string[]) => {
      setSelectedKeyframeId(keyframeId);
      setSelectedLightIds(new Set(lightIds));
  };

  // 键盘快捷键
  useKeyboardShortcuts({
      onUndo: undo,
      onRedo: redo,
      onDelete: handleDeleteKeyframe,
      onSpacePress: () => {} // 空格键由 useCanvasPan 内部处理
  });

  // 初始化
  useEffect(() => {
    if (project && project.animations.length > 0 && !selectedAnimationId) {
        setSelectedAnimationId(project.animations[0].id);
    }
  }, [project, selectedAnimationId]);

  // 播放时清空选区
  useEffect(() => {
    if (isPlaying) {
        setSelectedLightIds(new Set());
    }
  }, [isPlaying]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <EditorToolbar 
        projectName={project?.name}
        onBack={() => navigate('/')}
        onSaveTemplate={openTemplateDialog}
        onExport={() => toast('导出工程功能尚未实现', 'info')} 
      />

      <div className="flex-1 flex overflow-hidden">
          <AnimationLibrary 
            templates={localTemplates}
            savedSelections={project?.savedSelections || []}
            hasSelection={selectedLightIds.size > 0}
            onAddKeyframe={handleAddKeyframe}
            onApplyTemplate={(template) => {
                openConfirmDialog(
                    "应用模板",
                    `应用模板 "${template.name}"? 这将覆盖当前动画。`,
                    () => handleApplyTemplate(template, closeConfirmDialog)
                );
            }}
            onRestoreSelection={handleRestoreSelection}
            onDeleteSelection={handleDeleteSelection}
          />

          <PreviewArea 
            lightGroup={lightGroup}
            currentAnimation={currentAnimation}
            currentTime={currentTime}
            selectedLightIds={selectedLightIds}
            onSelectionChange={setSelectedLightIds}
            onSaveSelection={handleSaveSelection}
          />
          
          <Inspector 
            selectedKeyframeId={selectedKeyframeId}
            currentKeyframe={currentKeyframe}
            onUpdateKeyframe={handleUpdateKeyframe}
            onDuplicate={handleDuplicateKeyframe}
            onDelete={handleDeleteKeyframe}
          />
      </div>

      <Timeline 
        project={project}
        currentTime={currentTime}
        selectedAnimationId={selectedAnimationId}
        isPlaying={isPlaying}
        isLooping={isLooping}
        canUndo={canUndo}
        canRedo={canRedo}
        onTimeChange={setCurrentTime}
        onAnimationSelect={setSelectedAnimationId}
        onProjectUpdate={updateProject}
        onKeyframeSelect={handleKeyframeSelect}
        onPlayPause={handlePlayPause}
        onStop={handleStop}
        onLoopToggle={handleLoopToggle}
        onUndo={undo}
        onRedo={redo}
        onSaveAnimAsTemplate={handleSaveAnimAsTemplate}
      />

      <Dialog 
        isOpen={templateDialog.isOpen} 
        onClose={closeTemplateDialog} 
        title="保存为模板"
        footer={
          <Button onClick={() => {
            handleSaveAsTemplate(templateDialog.name);
            closeTemplateDialog();
          }}>
            保存
          </Button>
        }
      >
          <div className="space-y-2">
              <Label>模板名称</Label>
              <Input 
                value={templateDialog.name} 
                onChange={e => setTemplateName(e.target.value)} 
                placeholder="我的酷炫波浪" 
              />
          </div>
      </Dialog>

      <Dialog
        isOpen={selectionDialog.isOpen}
        onClose={closeSelectionDialog} 
        title="保存选区"
        footer={
            <>
                <Button variant="ghost" onClick={closeSelectionDialog}>取消</Button>
                <Button onClick={() => {
                    handleConfirmSaveSelection(selectionDialog.name);
                    closeSelectionDialog();
                }}>
                    保存
                </Button>
            </>
        }
      >
          <div className="space-y-2">
             <Label>选区名称</Label>
             <Input 
               value={selectionDialog.name} 
               onChange={e => setSelectionName(e.target.value)} 
               placeholder="如：矩阵中心" 
             />
          </div>
      </Dialog>

      <ConfirmDialog 
          isOpen={confirmDialog.isOpen}
          onClose={closeConfirmDialog}
          onConfirm={confirmDialog.onConfirm}
          title={confirmDialog.title}
          message={confirmDialog.message}
      />
    </div>
  );
}
