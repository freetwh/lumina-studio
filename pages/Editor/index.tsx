
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

// 辅助函数：计算动画时长
const calculateDuration = (keyframes: Keyframe[]) => {
    if (!keyframes || keyframes.length === 0) return 2000;
    const end = Math.max(0, ...keyframes.map(k => k.startTime + k.duration));
    return Math.max(end, 2000);
};

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
  // previewRef 指向 PreviewArea 内部实际承载 Grid 的 DOM 元素 (应用了样式宽高的那个)
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
    
    if (proj.animations.length === 0) {
        proj.animations.push({ id: generateId(), name: '灯效 1', keyframes: [], duration: 5000 });
    } else {
         proj.animations.forEach((a, i) => { if (a.name === '主动画') a.name = `灯效 ${i + 1}`; });
    }

    initHistory(proj); 
    setTemplates(data.templates);
    
    const grp = data.lightGroups.find(g => g.id === proj.lightGroupId);
    
    if (grp) {
        setLightGroup(grp);
    } else {
        if (data.lightGroups.length > 0) {
            setLightGroup(data.lightGroups[0]);
        } else {
            setLightGroup(null);
        }
    }

    if (proj.animations.length > 0) {
        setSelectedAnimationId(proj.animations[0].id);
    }
  }, [projectId, navigate, initHistory]);

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
             e.preventDefault(); 
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

  // --- 播放时点击清空选区 ---
  useEffect(() => {
    if (isPlaying) {
        setSelectedLightIds(new Set());
    }
  }, [isPlaying]);

  // --- 交互逻辑 (鼠标移动 / 抬起) ---
  useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
          // 0. 画布拖拽逻辑 (Screen Space 1:1)
          if (isPanning && panStartRef.current) {
              const dx = e.clientX - panStartRef.current.x;
              const dy = e.clientY - panStartRef.current.y;
              setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
              panStartRef.current = { x: e.clientX, y: e.clientY };
              return; 
          }

          // 1. 框选逻辑 (基于实际 DOM 渲染位置计算)
          if (selectionStartRef.current && previewRef.current && !isSpacePressed) {
              // 获取 Grid 容器在屏幕上的实际位置和尺寸
              // 这个 Rect 已经包含了 transform (scale + translate) 的所有影响
              const rect = previewRef.current.getBoundingClientRect();
              
              // 我们的内部坐标系是基于 style.width/height 定义的（例如 300x600）
              // getBoundingClientRect 拿到的是缩放后的 px
              // 需要计算当前的实际缩放比例
              const internalWidth = parseFloat(previewRef.current.style.width) || 1;
              const internalHeight = parseFloat(previewRef.current.style.height) || 1;
              
              const scaleX = rect.width / internalWidth;
              const scaleY = rect.height / internalHeight;

              // 计算鼠标相对于 Grid 左上角的坐标 (Local Space Pixels)
              const localX = (e.clientX - rect.left) / scaleX;
              const localY = (e.clientY - rect.top) / scaleY;

              const startX = selectionStartRef.current.x; 
              const startY = selectionStartRef.current.y;
              
              const newBox = {
                  x: Math.min(startX, localX),
                  y: Math.min(startY, localY),
                  w: Math.abs(localX - startX),
                  h: Math.abs(localY - startY)
              };
              
              setSelectionBox(newBox);
              
              if (lightGroup) {
                  const boxSelectedIds = new Set<string>();
                  
                  // 使用 internalWidth/Height 来计算节点的像素位置进行碰撞检测
                  const contentWidth = internalWidth;
                  const contentHeight = internalHeight;

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
              updatedAnim.duration = calculateDuration(updatedKeyframes);
              
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
      
      if (isSpacePressed) {
          setIsPanning(true);
          panStartRef.current = { x: e.clientX, y: e.clientY };
          return;
      }
      
      // 防止 Alt 键触发浏览器默认行为（如窗口菜单）
      if (e.altKey) e.preventDefault();

      // 获取当前视口的实际边界（包含缩放和平移）
      const rect = previewRef.current.getBoundingClientRect();
      
      const internalWidth = parseFloat(previewRef.current.style.width) || 1;
      const internalHeight = parseFloat(previewRef.current.style.height) || 1;
      
      const scaleX = rect.width / internalWidth;
      const scaleY = rect.height / internalHeight;
      
      // 计算相对于内部坐标系的位置
      const startX = (e.clientX - rect.left) / scaleX;
      const startY = (e.clientY - rect.top) / scaleY;
      
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
      if (e.altKey) e.preventDefault(); // 防止默认行为
      
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
      updatedAnim.duration = calculateDuration(updatedAnim.keyframes);

      const updatedProject = {
          ...project,
          animations: project.animations.map(a => a.id === a.id ? updatedAnim : a)
      };

      updateProject(updatedProject);
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
            updatedAnim.duration = calculateDuration(updatedAnim.keyframes);

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
       updatedAnim.duration = calculateDuration(updatedKeyframes);

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
      updatedAnim.duration = calculateDuration(remainingKeyframes);

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
      updatedAnim.duration = calculateDuration(updatedAnim.keyframes);
      
      const updatedProject = {
           ...project,
           animations: project.animations.map(a => a.id === selectedAnimationId ? updatedAnim : a)
      };
      updateProject(updatedProject);
  };

  // --- 重写的灯光渲染逻辑 ---
  const getLightStyleReal = (nodeId: string) => {
      const baseR = 51; 
      const baseG = 51;
      const baseB = 51;
      const defaultStyle = { backgroundColor: `rgb(${baseR},${baseG},${baseB})`, boxShadow: 'none' };
      if (!currentAnimation) return defaultStyle; 
      
      // 1. 查找所有作用于当前节点且处于时间范围内的关键帧
      // 使用 < (startTime + duration) 确保如果一个动画在1000ms结束，另一个在1000ms开始，不会产生闪烁或双重计算
      const activeFrames = currentAnimation.keyframes.filter(k => 
          k.targetLightIds.includes(nodeId) && 
          currentTime >= k.startTime && 
          currentTime < (k.startTime + k.duration)
      );

      // 2. 如果没有任何活跃的动画帧，返回默认样式（灭灯状态）
      // 这自然地实现了"播放完自动移除/重置"的需求
      if (activeFrames.length === 0) {
          return defaultStyle;
      }

      // 3. 处理多轨道冲突：按照 Track ID 排序，ID 越大层级越高（覆盖下层）
      activeFrames.sort((a, b) => a.trackId - b.trackId);
      
      // 4. 取最上层的一个作为最终渲染依据
      const activeFrame = activeFrames[activeFrames.length - 1];

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
            if (isPlaying && globalPlayMode) {
                setIsPlaying(false);
                setGlobalPlayMode(false);
            } else {
                setGlobalPlayMode(true);
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
            if (selectedAnimationId !== id) {
                setSelectedAnimationId(id);
                setCurrentTime(0);
            }
            setGlobalPlayMode(false); 
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
