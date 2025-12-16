
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  
  // 画布拖拽状态
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number, y: number } | null>(null);

  // 播放控制
  const [globalPlayMode, setGlobalPlayMode] = useState(false);
  
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

  // 播放完成后的回调，用于全局顺序播放
  const handleAnimationFinish = useCallback(() => {
      if (!globalPlayMode || !project) return;
      
      const currentIndex = project.animations.findIndex(a => a.id === selectedAnimationId);
      if (currentIndex !== -1 && currentIndex < project.animations.length - 1) {
          // 播放下一个
          const nextAnim = project.animations[currentIndex + 1];
          setSelectedAnimationId(nextAnim.id);
          // 注意：useAnimationLoop 内部会因为 selectedAnimationId 改变导致 duration 改变
          // 我们需要重置时间。setCurrentTime 在 hook 外部调用需要小心时机，
          // 但这里的逻辑是状态更新 -> 重新渲染 -> hook 接收新 duration -> 
          // 我们可以通过 ref 或者由 hook 内部重置。
          // 简单起见，我们在切换时手动重置为 0
          setCurrentTime(0);
      } else {
          // 全部播放完毕
          setIsPlaying(false);
          setGlobalPlayMode(false);
          setCurrentTime(0);
          // 回到第一个
          if (project.animations.length > 0) {
              setSelectedAnimationId(project.animations[0].id);
          }
      }
  }, [globalPlayMode, project, selectedAnimationId]);

  const { isPlaying, setIsPlaying, currentTime, setCurrentTime } = useAnimationLoop(duration, isLooping, handleAnimationFinish);

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
    
    // 兼容性处理：如果旧数据叫"主动画"，可以在这里改名，或者不改
    // 这里只初始化 history
    if (proj.animations.length === 0) {
        proj.animations.push({ id: generateId(), name: '灯效 1', keyframes: [], duration: 5000 });
    } else {
         // 确保有名字
         proj.animations.forEach((a, i) => { if (a.name === '主动画') a.name = `灯效 ${i + 1}`; });
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
          if (e.code === 'Space' && !e.repeat && !(e.target instanceof HTMLInputElement)) {
             e.preventDefault(); // 防止页面滚动
             setIsSpacePressed(true);
          }
      };
      
      const handleKeyUp = (e: KeyboardEvent) => {
         if (e.code === 'Space') {
             setIsSpacePressed(false);
             setIsPanning(false);
         }
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      return () => {
          window.removeEventListener('keydown', handleKeyDown);
          window.removeEventListener('keyup', handleKeyUp);
      };
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
          // 0. 画布拖拽逻辑
          if (isPanning && panStartRef.current) {
              const dx = e.clientX - panStartRef.current.x;
              const dy = e.clientY - panStartRef.current.y;
              setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
              panStartRef.current = { x: e.clientX, y: e.clientY };
              return; // 拖拽时不处理其他逻辑
          }

          // 1. 框选逻辑
          if (selectionStartRef.current && previewRef.current && !isSpacePressed) {
              const rect = previewRef.current.getBoundingClientRect();
              const scale = previewZoom; 
              
              // 框选坐标需要减去 pan 的偏移量，因为节点是平移过的
              const currentX = (e.clientX - rect.left) / scale - (pan.x / scale);
              const currentY = (e.clientY - rect.top) / scale - (pan.y / scale);
              const startX = selectionStartRef.current.x; 
              const startY = selectionStartRef.current.y;
              
              // 计算选框矩形 (逻辑坐标)
              const newBox = {
                  x: Math.min(startX, currentX),
                  y: Math.min(startY, currentY),
                  w: Math.abs(currentX - startX),
                  h: Math.abs(currentY - startY)
              };
              
              // 视觉上的选框需要加回 pan，因为选框div是绝对定位在容器内的，而容器被 transform 了
              // 这里我们需要注意：PreviewArea 里的 selectionBox 渲染是在 container 内部还是外部？
              // 查看代码：selectionBox 是渲染在 container 内部的。所以它的坐标应该是逻辑坐标。
              // 但是 container 已经应用了 pan。
              // 如果 startX 是基于无 pan 的坐标系的，那么 newBox 也是。
              // 当 container 移动了，selectionBox 作为子元素也会移动。
              // 所以这里的计算必须统一。
              // 修正：selectionStartRef 在 MouseDown 时记录的是 logic 坐标 (考虑了 pan)。
              setSelectionBox(newBox);
              
              if (lightGroup) {
                  const boxSelectedIds = new Set<string>();
                  const contentWidth = rect.width / scale;
                  const contentHeight = rect.height / scale;

                  lightGroup.nodes.forEach(node => {
                      // 节点的 x,y 是百分比
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
              const siblings = currentAnimation.keyframes.filter(k => 
                  k.id !== draggedKeyframe.id && k.trackId === newTrackId
              );

              const collision = siblings.find(k => {
                  const kEnd = k.startTime + k.duration;
                  const dragEnd = newStartTime + duration;
                  return newStartTime < kEnd && dragEnd > k.startTime;
              });

              if (collision) {
                  const kEnd = collision.startTime + collision.duration;
                  const snapBefore = collision.startTime - duration;
                  const snapAfter = kEnd;

                  if (Math.abs(newStartTime - snapBefore) < Math.abs(newStartTime - snapAfter)) {
                      newStartTime = snapBefore;
                  } else {
                      newStartTime = snapAfter;
                  }
              }
              
              newStartTime = Math.max(0, newStartTime);

              setDragGhost({
                  startTime: newStartTime,
                  trackId: newTrackId,
                  duration: duration
              });
          }
      };

      const handleMouseUp = (e: MouseEvent) => {
          if (isPanning) {
              setIsPanning(false);
              panStartRef.current = null;
          }

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
  }, [draggedKeyframe, dragGhost, project, currentAnimation, selectedAnimationId, timelineZoom, previewZoom, lightGroup, isSpacePressed, isPanning, pan]);

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
      
      // 如果按住了空格，开始拖拽画布
      if (isSpacePressed) {
          setIsPanning(true);
          panStartRef.current = { x: e.clientX, y: e.clientY };
          return;
      }

      const rect = previewRef.current.getBoundingClientRect();
      // 计算逻辑坐标 (Logic Coords) = (Mouse - Offset) / Scale - Pan
      // 这里的 Pan 需要除以 Scale，因为 Scale 是应用在 Pan 之外的 (transform: scale() translate()) 
      // 或者 transform: translate() scale()。
      // 在 PreviewArea 实现中是 scale(zoom) translate(pan)。
      // 也就是说 pan 是在缩放后的坐标系里的位移？不，PreviewArea 写的是 `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`
      // CSS transform order matters. Scale affects Translate if Scale is first.
      // `scale(2) translate(10px)` moves visually by 20px.
      // So logic coord X = (MouseX - RectLeft) / Scale - PanX
      
      const mouseX = (e.clientX - rect.left) / previewZoom;
      const mouseY = (e.clientY - rect.top) / previewZoom;
      const startX = mouseX - (pan.x);
      const startY = mouseY - (pan.y);
      
      selectionStartRef.current = { x: startX, y: startY };
      setSelectionBox({ x: startX, y: startY, w: 0, h: 0 });

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
      // 3. 点击动画关键帧时，自动选中关联的灯珠
      setSelectedKeyframeId(k.id);
      setSelectedLightIds(new Set(k.targetLightIds));
  };

  const handleSelectKeyframe = (id: string) => {
      setSelectedKeyframeId(id);
      const kf = currentAnimation?.keyframes.find(k => k.id === id);
      if (kf) {
          setSelectedLightIds(new Set(kf.targetLightIds));
      }
  }

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
      if (!currentAnimation || !project || selectedLightIds.size === 0) {
          if (selectedLightIds.size === 0) toast("请先选择灯珠", "error");
          return;
      }

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
      
      // 新增后选中该关键帧
      setSelectedKeyframeId(newKeyframe.id);
  };

  // --- Animation Management ---
  const handleAddAnimation = () => {
      if (!project) return;
      const newAnimName = `灯效 ${project.animations.length + 1}`;
      const newAnim = { id: generateId(), name: newAnimName, keyframes: [], duration: 5000 };
      updateProject({
          ...project,
          animations: [...project.animations, newAnim]
      });
      setSelectedAnimationId(newAnim.id);
      toast("已添加新灯效");
  };

  const handleRenameAnimation = (id: string, newName: string) => {
      if (!project) return;
      updateProject({
          ...project,
          animations: project.animations.map(a => a.id === id ? { ...a, name: newName } : a)
      });
  };

  const handleDeleteAnimation = (id: string) => {
      if (!project) return;
      if (project.animations.length <= 1) {
          toast("至少保留一个灯效", "error");
          return;
      }
      setConfirmDialog({
          isOpen: true,
          title: "删除灯效",
          message: "确定删除此灯效？无法撤销。",
          onConfirm: () => {
            const newAnims = project.animations.filter(a => a.id !== id);
            updateProject({
                ...project,
                animations: newAnims
            });
            if (selectedAnimationId === id) {
                setSelectedAnimationId(newAnims[0].id);
            }
            toast("灯效已删除");
          }
      });
  };

  const handleReorderAnimations = (dragIdx: number, dropIdx: number) => {
      if (!project) return;
      const items = Array.from(project.animations);
      const [reorderedItem] = items.splice(dragIdx, 1);
      items.splice(dropIdx, 0, reorderedItem);
      updateProject({ ...project, animations: items });
  };
  
  const handleSaveAnimAsTemplate = (id: string) => {
      if (!project) return;
      const anim = project.animations.find(a => a.id === id);
      if (!anim) return;
      
      const newTemplate: Template = {
          id: generateId(),
          name: anim.name + " (Template)",
          createdAt: Date.now(),
          keyframes: anim.keyframes.map(k => ({...k})), 
          lightGroupId: project.lightGroupId
      };
      
      const data = getStorageData();
      data.templates.push(newTemplate);
      saveStorageData(data);
      setTemplates(data.templates);
      toast("灯效已保存为模板", "success");
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
            pan={pan}
            isSpacePressed={isSpacePressed}
            onZoomChange={setPreviewZoom}
            getLightStyle={getLightStyleReal}
            onMouseDown={handlePreviewMouseDown}
            onLightClick={handleLightClick}
            onClearSelection={() => setSelectedLightIds(new Set())}
            onSaveSelection={handleSaveSelection}
            onCreateAnimation={() => handleAddKeyframe('fade')}
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
        onPlayPause={() => {
            // 全局顺序播放
            if (isPlaying && globalPlayMode) {
                setIsPlaying(false);
                setGlobalPlayMode(false);
            } else {
                setGlobalPlayMode(true);
                // 如果当前不是第一个，且时间为0，从第一个开始？或者从当前开始？
                // 需求："整个工程的播放按钮是把所有的灯效按从上往下的顺序播放"
                // 通常意味着从头开始，或者从当前选中的灯效开始播放直到结束。
                // 简单起见，如果当前不在播放，我们从当前选中的灯效开始
                setIsPlaying(true);
            }
        }}
        onStop={() => { setIsPlaying(false); setGlobalPlayMode(false); setCurrentTime(0); }}
        onLoopToggle={() => setIsLooping(!isLooping)}
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
            // 单独播放
            if (selectedAnimationId !== id) {
                setSelectedAnimationId(id);
                setCurrentTime(0);
            }
            setGlobalPlayMode(false); // 强制退出全局模式
            setIsPlaying(!isPlaying);
        }}
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
