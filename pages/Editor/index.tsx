/**
 * Editor - 灯效编辑器主组件
 * 
 * 职责：
 * 1. 管理核心业务状态（project, selectedAnimationId, currentTime, selectedLightIds）
 * 2. 组合子组件
 * 3. 协调各个业务 Hook
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useToast } from '../../components/ui/toast-context';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { calculateDuration } from './services/animationCalculator';

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
  const [selectedKeyframeIds, setSelectedKeyframeIds] = useState<Set<string>>(new Set());

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

  const selectedKeyframes = useMemo(() => {
      if (!currentAnimation) return [];
      return currentAnimation.keyframes.filter(k => selectedKeyframeIds.has(k.id));
  }, [currentAnimation, selectedKeyframeIds]);

  const selectedKeyframesSpanMs = useMemo(() => {
      if (selectedKeyframes.length === 0) return 0;
      const minStart = Math.min(...selectedKeyframes.map(k => k.startTime));
      const maxEnd = Math.max(...selectedKeyframes.map(k => k.startTime + k.duration));
      return Math.max(0, maxEnd - minStart);
  }, [selectedKeyframes]);

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

  const handleSelectedKeyframeIdsChange = useCallback((ids: Set<string>) => {
      setSelectedKeyframeIds(ids);
      if (ids.size === 0) {
          setSelectedKeyframeId(null);
      } else if (selectedKeyframeId && ids.has(selectedKeyframeId)) {
          // keep primary
      } else {
          setSelectedKeyframeId(Array.from(ids)[0]);
      }
  }, [selectedKeyframeId]);

  const handleDeleteSelectedKeyframes = useCallback(() => {
      if (!project || !currentAnimation) return;
      if (selectedKeyframeIds.size === 0) {
          handleDeleteKeyframe();
          return;
      }

      const remainingKeyframes = currentAnimation.keyframes.filter(k => !selectedKeyframeIds.has(k.id));
      const updatedAnim = { ...currentAnimation, keyframes: remainingKeyframes };
      updatedAnim.duration = calculateDuration(remainingKeyframes);

      const updatedProject = {
          ...project,
          animations: project.animations.map(a => a.id === selectedAnimationId ? updatedAnim : a)
      };
      updateProject(updatedProject);
      setSelectedKeyframeIds(new Set());
      setSelectedKeyframeId(null);
  }, [project, currentAnimation, selectedKeyframeIds, selectedAnimationId, updateProject, handleDeleteKeyframe]);

  const handleBatchSetTotalDuration = useCallback((newTotalMs: number) => {
      if (!project || !currentAnimation) return;
      if (selectedKeyframeIds.size === 0) return;

      const keyframesToScale = currentAnimation.keyframes.filter(k => selectedKeyframeIds.has(k.id));
      if (keyframesToScale.length === 0) return;

      const minStart = Math.min(...keyframesToScale.map(k => k.startTime));
      const maxEnd = Math.max(...keyframesToScale.map(k => k.startTime + k.duration));
      const oldTotal = Math.max(1, maxEnd - minStart);
      const nextTotal = Math.max(1, Math.floor(newTotalMs));

      const factor = nextTotal / oldTotal;

      const updatedKeyframes = currentAnimation.keyframes.map(k => {
          if (!selectedKeyframeIds.has(k.id)) return k;
          const relativeStart = k.startTime - minStart;
          const nextStart = Math.round(minStart + relativeStart * factor);
          const nextDuration = Math.max(1, Math.round(k.duration * factor));
          return { ...k, startTime: nextStart, duration: nextDuration };
      });

      const updatedAnim = { ...currentAnimation, keyframes: updatedKeyframes };
      updatedAnim.duration = calculateDuration(updatedKeyframes);

      const updatedProject = {
          ...project,
          animations: project.animations.map(a => a.id === selectedAnimationId ? updatedAnim : a)
      };
      updateProject(updatedProject);
  }, [project, currentAnimation, selectedKeyframeIds, selectedAnimationId, updateProject]);

  // 键盘快捷键
  useKeyboardShortcuts({
      onUndo: undo,
      onRedo: redo,
      onDelete: handleDeleteSelectedKeyframes,
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
            selectedKeyframeIds={selectedKeyframeIds}
            selectedKeyframesSpanMs={selectedKeyframesSpanMs}
            onUpdateKeyframe={handleUpdateKeyframe}
            onDuplicate={handleDuplicateKeyframe}
            onDelete={handleDeleteSelectedKeyframes}
            onBatchSetTotalDuration={handleBatchSetTotalDuration}
          />
      </div>

      <Timeline 
        project={project}
        currentTime={currentTime}
        selectedAnimationId={selectedAnimationId}
        selectedKeyframeId={selectedKeyframeId}
        selectedKeyframeIds={selectedKeyframeIds}
        isPlaying={isPlaying}
        isLooping={isLooping}
        canUndo={canUndo}
        canRedo={canRedo}
        onTimeChange={setCurrentTime}
        onAnimationSelect={setSelectedAnimationId}
        onProjectUpdate={updateProject}
        onSelectedKeyframeIdsChange={handleSelectedKeyframeIdsChange}
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
