/**
 * Editor - 灯效编辑器主组件
 * 
 * 职责：
 * 1. 组合各个业务 Hook，协调数据流
 * 2. 管理 UI 状态（选中项、缩放等）
 * 3. 处理用户交互事件路由
 * 4. 渲染主要 UI 组件
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { getStorageData, saveStorageData, generateId } from '../../utils';
import { Template } from '../../types';
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
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useCanvasPan } from './hooks/useCanvasPan';
import { useSelectionBox } from './hooks/useSelectionBox';
import { useKeyframeDrag } from './hooks/useKeyframeDrag';
import { useLightRenderer } from './hooks/useLightRenderer';
import { useKeyframeOperations } from './hooks/useKeyframeOperations';
import { useAnimationOperations } from './hooks/useAnimationOperations';
import { useSelectionOperations } from './hooks/useSelectionOperations';
import { useAnimationPlayback } from './hooks/useAnimationPlayback';

// 常量
const PIXELS_PER_SEC = 100;

export default function Editor() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // ========== 数据层 ==========
  const { project, lightGroup, templates, updateProject, undo, redo, canUndo, canRedo } = useProjectData(projectId);
  
  // ========== UI 状态 ==========
  const [selectedAnimationId, setSelectedAnimationId] = useState<string>('');
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>(null);

  // 本地模板状态（用于模板保存功能）
  const [localTemplates, setLocalTemplates] = useState<Template[]>([]);
  useEffect(() => {
    setLocalTemplates(templates);
  }, [templates]);
  
  // ========== DOM 引用 ==========
  const previewRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  
  // ========== 交互层 ==========
  const { pan, isSpacePressed, setIsSpacePressed, handleMouseDown: handleCanvasPanMouseDown } = useCanvasPan();
  const { selectionBox, selectedLightIds, setSelectedLightIds, handlePreviewMouseDown: handleSelectionMouseDown, handleLightClick } = useSelectionBox(lightGroup);

  // ========== 弹窗管理 ==========
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

  // ========== 派生状态 ==========
  const currentAnimation = useMemo(() => {
      return project?.animations.find(a => a.id === selectedAnimationId);
  }, [project, selectedAnimationId]);

  const currentKeyframe = useMemo(() => {
      return currentAnimation?.keyframes.find(k => k.id === selectedKeyframeId);
  }, [currentAnimation, selectedKeyframeId]);

  // ========== 业务逻辑层 ==========
  
  // 播放控制
  const {
      isPlaying,
      setIsPlaying,
      currentTime,
      setCurrentTime,
      isLooping,
      globalPlayMode,
      setGlobalPlayMode,
      handlePlayPause,
      handleStop,
      handleLoopToggle
  } = useAnimationPlayback({
      project,
      currentAnimation,
      selectedAnimationId,
      setSelectedAnimationId
  });

  // 灯光渲染
  const { getLightStyle } = useLightRenderer(currentAnimation, currentTime);

  // 关键帧操作
  const {
      handleAddKeyframe,
      handleUpdateKeyframe,
      handleDeleteKeyframe,
      handleDuplicateKeyframe
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

  // 动画操作
  const {
      handleAddAnimation,
      handleRenameAnimation,
      handleDeleteAnimation,
      handleReorderAnimations,
      handleSaveAnimAsTemplate,
      handleApplyTemplate
  } = useAnimationOperations({
      project,
      currentAnimation,
      selectedAnimationId,
      updateProject,
      setSelectedAnimationId,
      setCurrentTime,
      openConfirmDialog,
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

  // 关键帧拖拽
  const handleKeyframeDragComplete = useCallback((keyframeId: string, newStartTime: number, newTrackId: number) => {
      if (!currentAnimation || !project) return;
      
      const updatedKeyframes = currentAnimation.keyframes.map(k => 
          k.id === keyframeId ? { ...k, startTime: newStartTime, trackId: newTrackId } : k
      );
      
      const updatedProject = {
          ...project,
          animations: project.animations.map(a => 
              a.id === selectedAnimationId ? { ...a, keyframes: updatedKeyframes } : a
          )
      };

      updateProject(updatedProject);
  }, [currentAnimation, project, selectedAnimationId, updateProject]);

  const handleKeyframeSelectFromDrag = useCallback((keyframeId: string, targetLightIds: string[]) => {
      setSelectedKeyframeId(keyframeId);
      setSelectedLightIds(new Set(targetLightIds));
  }, [setSelectedLightIds]);

  const { dragGhost, handleKeyframeMouseDown } = useKeyframeDrag(
      currentAnimation,
      timelineZoom,
      handleKeyframeDragComplete,
      handleKeyframeSelectFromDrag
  );

  // ========== 副作用 ==========
  
  // 初始化选中的动画
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
  }, [isPlaying, setSelectedLightIds]);

  // 键盘快捷键
  useKeyboardShortcuts({
      onUndo: undo,
      onRedo: redo,
      onDelete: handleDeleteKeyframe,
      onSpacePress: setIsSpacePressed
  });

  // ========== 事件处理器 ==========
  
  // 时间轴点击
  const handleTimelineClick = (e: React.MouseEvent) => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const scrollLeft = timelineRef.current.scrollLeft;
      const x = e.clientX - rect.left + scrollLeft;
      const newTime = Math.max(0, (x / (PIXELS_PER_SEC * timelineZoom)) * 1000);
      setCurrentTime(newTime);
  };

  // 预览区鼠标按下（组合平移和框选）
  const handlePreviewMouseDown = (e: React.MouseEvent) => {
      handleCanvasPanMouseDown(e);
      handleSelectionMouseDown(e, previewRef, isSpacePressed);
  };

  // 选择关键帧
  const handleSelectKeyframe = (id: string) => {
      setSelectedKeyframeId(id);
      const kf = currentAnimation?.keyframes.find(k => k.id === id);
      if (kf) {
          setSelectedLightIds(new Set(kf.targetLightIds));
      }
  };

  // 保存为模板
  const handleSaveAsTemplate = () => {
      if (!templateDialog.name || !currentAnimation) return;
      const data = getStorageData();
      const newTemplate: Template = {
          id: generateId(),
          name: templateDialog.name,
          createdAt: Date.now(),
          keyframes: currentAnimation.keyframes.map(k => ({...k})), 
          lightGroupId: project?.lightGroupId
      };
      data.templates.push(newTemplate);
      saveStorageData(data);
      
      // 更新本地模板列表
      const updatedData = getStorageData();
      setLocalTemplates(updatedData.templates);
      closeTemplateDialog();
      toast("模板已保存！", "success");
  };

  // 确认保存选区
  const confirmSaveSelection = () => {
      handleConfirmSaveSelection(selectionDialog.name);
      closeSelectionDialog();
  };

  // ========== 渲染 ==========

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
            onApplyTemplate={handleApplyTemplate}
            onRestoreSelection={handleRestoreSelection}
            onDeleteSelection={handleDeleteSelection}
          />

          <PreviewArea 
            ref={previewRef}
            lightGroup={lightGroup}
            selectedLightIds={selectedLightIds}
            selectionBox={selectionBox}
            zoom={previewZoom}
            pan={pan}
            isSpacePressed={isSpacePressed}
            onZoomChange={setPreviewZoom}
            getLightStyle={getLightStyle}
            onMouseDown={handlePreviewMouseDown}
            onLightClick={handleLightClick}
            onClearSelection={() => setSelectedLightIds(new Set())}
            onSaveSelection={handleSaveSelection}
            onCreateAnimation={() => handleAddKeyframe('fade')}
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
        ref={timelineRef}
        project={project}
        currentAnimation={currentAnimation}
        selectedAnimationId={selectedAnimationId}
        selectedKeyframeId={selectedKeyframeId}
        currentTime={currentTime}
        isPlaying={isPlaying}
        isLooping={isLooping}
        zoom={timelineZoom}
        canUndo={canUndo}
        canRedo={canRedo}
        dragGhost={dragGhost}
        onPlayPause={handlePlayPause}
        onStop={handleStop}
        onLoopToggle={handleLoopToggle}
        onZoomChange={setTimelineZoom}
        onSelectAnimation={setSelectedAnimationId}
        onSelectKeyframe={handleSelectKeyframe}
        onKeyframeMouseDown={handleKeyframeMouseDown}
        onTimelineClick={handleTimelineClick}
        onUndo={undo}
        onRedo={redo}
        onAddAnimation={handleAddAnimation}
        onRenameAnimation={handleRenameAnimation}
        onDeleteAnimation={handleDeleteAnimation}
        onSaveAnimationAsTemplate={handleSaveAnimAsTemplate}
        onReorderAnimations={handleReorderAnimations}
        onPlaySingleAnimation={(id) => {
            if (selectedAnimationId !== id) {
                setSelectedAnimationId(id);
                setCurrentTime(0);
            }
            setGlobalPlayMode(false); 
            setIsPlaying(!isPlaying);
        }}
      />

      <Dialog 
        isOpen={templateDialog.isOpen} 
        onClose={closeTemplateDialog} 
        title="保存为模板"
        footer={<Button onClick={handleSaveAsTemplate}>保存</Button>}
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
                <Button onClick={confirmSaveSelection}>保存</Button>
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
