
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { getStorageData, saveStorageData, generateId, hexToRgb, lerp } from '../../utils';
import { Project, LightGroup, Keyframe, Template } from '../../types';
import { useAnimationLoop } from '../../hooks/useAnimationLoop';
import { useHistory } from '../../hooks/useHistory';
import { useToast } from '../../components/ui/toast-context';
import { ConfirmDialog } from '../../components/ConfirmDialog';

// Components
import { EditorToolbar } from './components/EditorToolbar';
import { AnimationLibrary } from './components/AnimationLibrary';
import { PreviewArea } from './components/PreviewArea';
import { Inspector } from './components/Inspector';
import { Timeline } from './components/Timeline';

// 常量定义
const PIXELS_PER_SEC = 100;
const TRACK_HEIGHT = 40;

export default function Editor() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // --- 数据状态 ---
  const { state: project, set: setProjectHistory, undo, redo, canUndo, canRedo, init: initHistory } = useHistory<Project>(null);
  const [lightGroup, setLightGroup] = useState<LightGroup | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  
  // --- UI 状态 ---
  const [selectedAnimationId, setSelectedAnimationId] = useState<string>('');
  const [selectedLightIds, setSelectedLightIds] = useState<Set<string>>(new Set());
  const [isLooping, setIsLooping] = useState(false);
  const [timelineZoom, setTimelineZoom] = useState(1); // 时间轴缩放
  const [previewZoom, setPreviewZoom] = useState(1); // 预览区缩放
  const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>(null);
  
  // --- 交互状态 ---
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  
  // 拖拽状态 & 拖影预览
  const [draggedKeyframe, setDraggedKeyframe] = useState<{ 
      id: string; 
      startX: number; 
      startY: number; 
      initialStartTime: number; 
      initialTrackId: number; 
      duration: number; // 记录时长用于渲染 ghost
  } | null>(null);
  
  const [dragGhost, setDragGhost] = useState<{ startTime: number; trackId: number; duration: number } | null>(null);
  
  // --- Refs ---
  const previewRef = useRef<HTMLDivElement>(null);
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null); 
  const initialSelectionRef = useRef<Set<string>>(new Set()); 
  const timelineRef = useRef<HTMLDivElement>(null);

  // --- 弹窗状态 ---
  const [isTemplateSaveOpen, setIsTemplateSaveOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  
  // 保存选区弹窗
  const [isSaveSelectionOpen, setIsSaveSelectionOpen] = useState(false);
  const [newSelectionName, setNewSelectionName] = useState('');

  // 确认对话框状态
  const [confirmDialog, setConfirmDialog] = useState<{
      isOpen: boolean;
      title: string;
      message: string;
      onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // 派生状态: 当前选中的动画节点
  const currentAnimation = useMemo(() => {
      return project?.animations.find(a => a.id === selectedAnimationId);
  }, [project, selectedAnimationId]);

  const duration = currentAnimation ? currentAnimation.duration : 5000;
  const { isPlaying, setIsPlaying, currentTime, setCurrentTime } = useAnimationLoop(duration, isLooping);

  const currentKeyframe = useMemo(() => {
      return currentAnimation?.keyframes.find(k => k.id === selectedKeyframeId);
  }, [currentAnimation, selectedKeyframeId]);

  // 加载工程数据
  useEffect(() => {
    if (!projectId) return;
    const data = getStorageData();
    const proj = data.projects.find(p => p.id === projectId);
    if (!proj) {
        navigate('/');
        return;
    }
    initHistory(proj); 
    setTemplates(data.templates);
    
    const grp = data.lightGroups.find(g => g.id === proj.lightGroupId);
    
    if (grp) {
        setLightGroup(grp);
    } else {
        if (data.lightGroups.length > 0) {
            console.warn(`未找到灯组 ${proj.lightGroupId}，回退到默认。`);
            setLightGroup(data.lightGroups[0]);
        } else {
            console.error("无可用灯组。");
            setLightGroup(null);
        }
    }

    if (proj.animations.length > 0) {
        setSelectedAnimationId(proj.animations[0].id);
    }
  }, [projectId, navigate, initHistory]);

  // 保存工程辅助函数
  const updateProject = (updatedProject: Project) => {
      setProjectHistory(updatedProject); 
      
      const data = getStorageData();
      const idx = data.projects.findIndex(p => p.id === updatedProject.id);
      if (idx !== -1) {
          data.projects[idx] = updatedProject;
          saveStorageData(data);
      }
  };

  // --- 键盘快捷键 ---
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
              e.preventDefault();
              undo();
          }
          if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
              e.preventDefault();
              redo();
          }
          if (e.key === 'Backspace') {
              if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
              if (selectedKeyframeId) {
                  handleDeleteKeyframe();
              }
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, selectedKeyframeId, project]); 

  // --- 播放逻辑 ---
  useEffect(() => {
    if (isPlaying) {
        setSelectedLightIds(new Set());
    }
  }, [isPlaying]);

  // --- 交互逻辑 (鼠标移动 / 抬起) ---
  useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
          // 1. 框选逻辑
          if (selectionStartRef.current && previewRef.current) {
              const rect = previewRef.current.getBoundingClientRect();
              const scale = previewZoom; 
              
              const currentX = (e.clientX - rect.left) / scale;
              const currentY = (e.clientY - rect.top) / scale;
              const startX = selectionStartRef.current.x; 
              const startY = selectionStartRef.current.y;
              
              const newBox = {
                  x: Math.min(startX, currentX),
                  y: Math.min(startY, currentY),
                  w: Math.abs(currentX - startX),
                  h: Math.abs(currentY - startY)
              };
              setSelectionBox(newBox);
              
              if (lightGroup) {
                  const boxSelectedIds = new Set<string>();
                  const contentWidth = rect.width / scale;
                  const contentHeight = rect.height / scale;

                  lightGroup.nodes.forEach(node => {
                      const nodeX = (node.x / 100) * contentWidth;
                      const nodeY = (node.y / 100) * contentHeight;
                      if (nodeX >= newBox.x && nodeX <= newBox.x + newBox.w &&
                          nodeY >= newBox.y && nodeY <= newBox.y + newBox.h) {
                          boxSelectedIds.add(node.id);
                      }
                  });

                  const finalSelection = new Set(initialSelectionRef.current);
                  if (e.shiftKey) {
                      boxSelectedIds.forEach(id => finalSelection.add(id));
                  } else if (e.altKey) {
                      boxSelectedIds.forEach(id => finalSelection.delete(id));
                  } else {
                      setSelectedLightIds(boxSelectedIds);
                      return; 
                  }
                  setSelectedLightIds(finalSelection);
              }
          }

          // 2. 关键帧拖拽逻辑
          if (draggedKeyframe && project && currentAnimation) {
              e.preventDefault();
              const deltaX = e.clientX - draggedKeyframe.startX;
              const deltaY = e.clientY - draggedKeyframe.startY;
              
              const timeDelta = (deltaX / (PIXELS_PER_SEC * timelineZoom)) * 1000;
              let newStartTime = Math.max(0, Math.floor(draggedKeyframe.initialStartTime + timeDelta));
              
              const trackDelta = Math.round(deltaY / TRACK_HEIGHT);
              const newTrackId = Math.max(0, Math.min(5, draggedKeyframe.initialTrackId + trackDelta));

              // --- 碰撞检测与吸附逻辑 ---
              const duration = draggedKeyframe.duration;
              // 找到目标轨道上的其他关键帧 (排除自己)
              const siblings = currentAnimation.keyframes.filter(k => 
                  k.id !== draggedKeyframe.id && k.trackId === newTrackId
              );

              // 查找是否发生重叠
              // 重叠条件: !(dragEnd <= siblingStart || dragStart >= siblingEnd)
              const collision = siblings.find(k => {
                  const kEnd = k.startTime + k.duration;
                  const dragEnd = newStartTime + duration;
                  return newStartTime < kEnd && dragEnd > k.startTime;
              });

              if (collision) {
                  // 如果发生碰撞，计算吸附位置
                  const kEnd = collision.startTime + collision.duration;
                  
                  // 选项 A: 吸附到碰撞物体的前面
                  const snapBefore = collision.startTime - duration;
                  // 选项 B: 吸附到碰撞物体的后面
                  const snapAfter = kEnd;

                  // 比较哪个位置离当前鼠标计算出的位置更近
                  if (Math.abs(newStartTime - snapBefore) < Math.abs(newStartTime - snapAfter)) {
                      newStartTime = snapBefore;
                  } else {
                      newStartTime = snapAfter;
                  }
              }
              
              // 再次确保不小于 0 (因为吸附到前面可能导致负值)
              newStartTime = Math.max(0, newStartTime);

              setDragGhost({
                  startTime: newStartTime,
                  trackId: newTrackId,
                  duration: duration
              });
          }
      };

      const handleMouseUp = (e: MouseEvent) => {
          if (selectionStartRef.current) {
              selectionStartRef.current = null;
              setSelectionBox(null);
          }
          
          if (draggedKeyframe && project && currentAnimation && dragGhost) {
              const updatedKeyframes = currentAnimation.keyframes.map(k => 
                  k.id === draggedKeyframe.id ? { ...k, startTime: dragGhost.startTime, trackId: dragGhost.trackId } : k
              );
              
              const updatedAnim = { ...currentAnimation, keyframes: updatedKeyframes };
              const maxDur = Math.max(...updatedKeyframes.map(k => k.startTime + k.duration), currentAnimation.duration);
              updatedAnim.duration = maxDur;
              
              const updatedProject = {
                  ...project,
                  animations: project.animations.map(a => a.id === selectedAnimationId ? updatedAnim : a)
              };

              updateProject(updatedProject);
              setDraggedKeyframe(null);
              setDragGhost(null);
          } else if (draggedKeyframe) {
              setDraggedKeyframe(null);
              setDragGhost(null);
          }
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
      };
  }, [draggedKeyframe, dragGhost, project, currentAnimation, selectedAnimationId, timelineZoom, previewZoom, lightGroup]);

  // --- 事件处理 ---
  
  const handleTimelineClick = (e: React.MouseEvent) => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const scrollLeft = timelineRef.current.scrollLeft;
      const x = e.clientX - rect.left + scrollLeft;
      const newTime = Math.max(0, (x / (PIXELS_PER_SEC * timelineZoom)) * 1000);
      setCurrentTime(newTime);
  };

  const handlePreviewMouseDown = (e: React.MouseEvent) => {
      if (!previewRef.current) return;
      
      const rect = previewRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / previewZoom;
      const y = (e.clientY - rect.top) / previewZoom;
      
      selectionStartRef.current = { x, y };
      setSelectionBox({ x, y, w: 0, h: 0 });

      if (e.shiftKey || e.altKey) {
          initialSelectionRef.current = new Set(selectedLightIds);
      } else {
          initialSelectionRef.current = new Set();
          setSelectedLightIds(new Set()); 
      }
  };

  const handleLightClick = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setSelectedLightIds(prev => {
          const next = new Set(prev);
          if (e.shiftKey) {
              next.add(id);
          } else if (e.altKey) {
              next.delete(id);
          } else {
              return new Set([id]);
          }
          return next;
      });
  };

  const handleKeyframeMouseDown = (e: React.MouseEvent, k: Keyframe) => {
      e.stopPropagation();
      setDraggedKeyframe({ 
          id: k.id, 
          startX: e.clientX, 
          startY: e.clientY,
          initialStartTime: k.startTime,
          initialTrackId: k.trackId,
          duration: k.duration
      });
      setDragGhost({
          startTime: k.startTime,
          trackId: k.trackId,
          duration: k.duration
      });
      setSelectedKeyframeId(k.id);
  };

  const handleSaveSelection = () => {
      if (selectedLightIds.size === 0 || !project) {
          toast("请先选择灯珠！", "error");
          return;
      }
      setNewSelectionName("选区 " + ((project.savedSelections?.length || 0) + 1));
      setIsSaveSelectionOpen(true);
  };

  const confirmSaveSelection = () => {
      if (!project || !newSelectionName) return;
      const newSelection = {
          id: generateId(),
          name: newSelectionName,
          lightIds: Array.from(selectedLightIds)
      };
      const updatedProject = {
          ...project,
          savedSelections: [...(project.savedSelections || []), newSelection]
      };
      updateProject(updatedProject);
      toast(`选区 "${newSelectionName}" 保存成功！`, "success");
      setIsSaveSelectionOpen(false);
  };

  const handleRestoreSelection = (ids: string[]) => {
      setSelectedLightIds(new Set(ids));
  };

  const handleDeleteSelection = (id: string) => {
      setConfirmDialog({
          isOpen: true,
          title: "删除选区",
          message: "确定删除此选区记录？",
          onConfirm: () => {
            if(!project) return;
            const updatedProject = {
                ...project,
                savedSelections: (project.savedSelections || []).filter(s => s.id !== id)
            };
            updateProject(updatedProject);
            toast("选区已删除");
          }
      });
  };

  const handleAddKeyframe = (type: string) => {
      if (!currentAnimation || !project || selectedLightIds.size === 0) return;

      const newKeyframe: Keyframe = {
          id: generateId(),
          trackId: 0, 
          startTime: currentTime,
          duration: 1000,
          targetLightIds: Array.from(selectedLightIds),
          animationType: type,
          fromState: { color: '#000000', brightness: 0 },
          toState: { color: type === 'flash' ? '#ffffff' : '#ff0000', brightness: 1 }
      };

      let targetTrack = 0;
      let hasCollision = true;
      while (hasCollision) {
          hasCollision = currentAnimation.keyframes.some(k => 
              k.trackId === targetTrack && 
              !(k.startTime + k.duration <= newKeyframe.startTime || k.startTime >= newKeyframe.startTime + newKeyframe.duration)
          );
          if (hasCollision) targetTrack++;
      }
      newKeyframe.trackId = targetTrack;

      const updatedAnim = {
          ...currentAnimation,
          keyframes: [...currentAnimation.keyframes, newKeyframe]
      };
      
      const end = newKeyframe.startTime + newKeyframe.duration;
      if (end > updatedAnim.duration) updatedAnim.duration = end;

      const updatedProject = {
          ...project,
          animations: project.animations.map(a => a.id === a.id ? updatedAnim : a)
      };

      updateProject(updatedProject);
      setIsPlaying(true); 
  };

  const handleApplyTemplate = (template: Template) => {
      setConfirmDialog({
          isOpen: true,
          title: "应用模板",
          message: `应用模板 "${template.name}"? 这将覆盖当前动画。`,
          onConfirm: () => {
            if (!currentAnimation || !project) return;

            const updatedAnim = {
                ...currentAnimation,
                keyframes: template.keyframes.map(k => ({...k, id: generateId()})), 
            };
            const maxDur = Math.max(...updatedAnim.keyframes.map(k => k.startTime + k.duration), 5000);
            updatedAnim.duration = maxDur;

            const updatedProject = {
                ...project,
                animations: project.animations.map(a => a.id === selectedAnimationId ? updatedAnim : a)
            };
            updateProject(updatedProject);
            setCurrentTime(0);
            toast("模板已应用", "success");
          }
      });
  };

  const handleSaveAsTemplate = () => {
      if (!newTemplateName || !currentAnimation) return;
      const data = getStorageData();
      const newTemplate: Template = {
          id: generateId(),
          name: newTemplateName,
          createdAt: Date.now(),
          keyframes: currentAnimation.keyframes.map(k => ({...k})), 
          lightGroupId: project?.lightGroupId
      };
      data.templates.push(newTemplate);
      saveStorageData(data);
      setTemplates(data.templates);
      setIsTemplateSaveOpen(false);
      setNewTemplateName('');
      toast("模板已保存！", "success");
  };

  const handleKeyframeUpdate = (kfId: string, updates: Partial<Keyframe>) => {
       if (!currentAnimation || !project) return;
       const updatedKeyframes = currentAnimation.keyframes.map(k => 
           k.id === kfId ? { ...k, ...updates } : k
       );
       const updatedAnim = { ...currentAnimation, keyframes: updatedKeyframes };
       const maxDur = Math.max(...updatedKeyframes.map(k => k.startTime + k.duration), currentAnimation.duration);
       updatedAnim.duration = maxDur;

       const updatedProject = {
           ...project,
           animations: project.animations.map(a => a.id === selectedAnimationId ? updatedAnim : a)
       };
       updateProject(updatedProject);
  };
  
  const handleDeleteKeyframe = () => {
      if (!selectedKeyframeId || !currentAnimation || !project) return;
      const kfToDelete = currentAnimation.keyframes.find(k => k.id === selectedKeyframeId);
      if(!kfToDelete) return;

      let remainingKeyframes = currentAnimation.keyframes.filter(k => k.id !== selectedKeyframeId);
      remainingKeyframes = remainingKeyframes.map(k => {
          if (k.trackId === kfToDelete.trackId && k.startTime > kfToDelete.startTime) {
              return { ...k, startTime: k.startTime - kfToDelete.duration };
          }
          return k;
      });

      const updatedAnim = { ...currentAnimation, keyframes: remainingKeyframes };
      const updatedProject = {
           ...project,
           animations: project.animations.map(a => a.id === selectedAnimationId ? updatedAnim : a)
      };
      updateProject(updatedProject);
      setSelectedKeyframeId(null);
  };
  
  const handleDuplicateKeyframe = () => {
      if (!selectedKeyframeId || !currentAnimation || !project) return;
      const kf = currentAnimation.keyframes.find(k => k.id === selectedKeyframeId);
      if(!kf) return;
      
      const newKf = { 
          ...kf, 
          id: generateId(), 
          startTime: kf.startTime + kf.duration 
      };
      
      const updatedAnim = { ...currentAnimation, keyframes: [...currentAnimation.keyframes, newKf] };
      const updatedProject = {
           ...project,
           animations: project.animations.map(a => a.id === selectedAnimationId ? updatedAnim : a)
      };
      updateProject(updatedProject);
  };

  const getLightStyleReal = (nodeId: string) => {
      const baseR = 51; 
      const baseG = 51;
      const baseB = 51;
      const defaultStyle = { backgroundColor: `rgb(${baseR},${baseG},${baseB})`, boxShadow: 'none' };
      if (!currentAnimation) return defaultStyle; 
      
      let keyframesToRender = currentAnimation.keyframes;

      const activeFrame = keyframesToRender.find(k => 
          k.targetLightIds.includes(nodeId) && 
          currentTime >= k.startTime && 
          currentTime <= (k.startTime + k.duration)
      );

      if (activeFrame) {
          const progress = (currentTime - activeFrame.startTime) / activeFrame.duration;
          const p = Math.min(Math.max(progress, 0), 1);
          const fromColor = hexToRgb(activeFrame.fromState.color);
          const toColor = hexToRgb(activeFrame.toState.color);
          const frameR = lerp(fromColor.r, toColor.r, p);
          const frameG = lerp(fromColor.g, toColor.g, p);
          const frameB = lerp(fromColor.b, toColor.b, p);
          const fromBright = activeFrame.fromState.brightness ?? 0;
          const toBright = activeFrame.toState.brightness ?? 1;
          const brightness = lerp(fromBright, toBright, p);
          const r = Math.round(lerp(baseR, frameR, brightness));
          const g = Math.round(lerp(baseG, frameG, brightness));
          const b = Math.round(lerp(baseB, frameB, brightness));
          return {
              backgroundColor: `rgb(${r},${g},${b})`,
              boxShadow: brightness > 0.1 ? `0 0 ${15 * brightness}px rgba(${frameR},${frameG},${frameB}, ${0.8 * brightness})` : 'none'
          };
      }
      return defaultStyle;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <EditorToolbar 
        projectName={project?.name}
        onBack={() => navigate('/')}
        onSaveTemplate={() => setIsTemplateSaveOpen(true)}
        onExport={() => toast('导出工程功能尚未实现', 'info')} 
      />

      <div className="flex-1 flex overflow-hidden">
          <AnimationLibrary 
            templates={templates}
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
            onZoomChange={setPreviewZoom}
            getLightStyle={getLightStyleReal}
            onMouseDown={handlePreviewMouseDown}
            onLightClick={handleLightClick}
            onClearSelection={() => setSelectedLightIds(new Set())}
            onSaveSelection={handleSaveSelection}
          />
          
          <Inspector 
            selectedKeyframeId={selectedKeyframeId}
            currentKeyframe={currentKeyframe}
            onUpdateKeyframe={handleKeyframeUpdate}
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
        onPlayPause={() => setIsPlaying(!isPlaying)}
        onStop={() => { setIsPlaying(false); setCurrentTime(0); }}
        onLoopToggle={() => setIsLooping(!isLooping)}
        onZoomChange={setTimelineZoom}
        onSelectAnimation={setSelectedAnimationId}
        onSelectKeyframe={setSelectedKeyframeId}
        onKeyframeMouseDown={handleKeyframeMouseDown}
        onTimelineClick={handleTimelineClick}
        onUndo={undo}
        onRedo={redo}
      />

      <Dialog 
        isOpen={isTemplateSaveOpen} 
        onClose={() => setIsTemplateSaveOpen(false)} 
        title="保存为模板"
        footer={<Button onClick={handleSaveAsTemplate}>保存</Button>}
      >
          <div className="space-y-2">
              <Label>模板名称</Label>
              <Input value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)} placeholder="我的酷炫波浪" />
          </div>
      </Dialog>

      <Dialog
        isOpen={isSaveSelectionOpen}
        onClose={() => setIsSaveSelectionOpen(false)}
        title="保存选区"
        footer={
            <>
                <Button variant="ghost" onClick={() => setIsSaveSelectionOpen(false)}>取消</Button>
                <Button onClick={confirmSaveSelection}>保存</Button>
            </>
        }
      >
          <div className="space-y-2">
             <Label>选区名称</Label>
             <Input value={newSelectionName} onChange={e => setNewSelectionName(e.target.value)} placeholder="如：矩阵中心" />
          </div>
      </Dialog>

      <ConfirmDialog 
          isOpen={confirmDialog.isOpen}
          onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
          onConfirm={confirmDialog.onConfirm}
          title={confirmDialog.title}
          message={confirmDialog.message}
      />
    </div>
  );
}
