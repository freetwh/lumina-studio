/**
 * Timeline 组件 - 时间轴和动画管理
 * 
 * 职责：
 * - 组合内部 Hooks（useKeyframeDrag）
 * - 管理自己的 UI 状态（zoom）
 * - 处理动画 CRUD
 */

import React, { forwardRef, useState, useRef, useEffect, useMemo } from 'react';
import { Play, Pause, Square, RotateCw, Plus, Undo2, Redo2, GripVertical, Trash2, Save, PenLine } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../components/ui/utils';
import { Project, AnimationNode, Keyframe } from '../../../types';
import { generateId } from '../../../utils';
import { useKeyframeDrag } from '../hooks/useKeyframeDrag';

interface TimelineProps {
  project: Project | null;
  currentTime: number;
  selectedAnimationId: string;
  isPlaying: boolean;
  isLooping: boolean;
  canUndo: boolean;
  canRedo: boolean;
  
  onTimeChange: (time: number) => void;
  onAnimationSelect: (id: string) => void;
  onProjectUpdate: (project: Project) => void;
  onKeyframeSelect?: (keyframeId: string, lightIds: string[]) => void;
  onPlayPause: () => void;
  onStop: () => void;
  onLoopToggle: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSaveAnimAsTemplate?: (id: string) => void;
}

const TRACK_HEIGHT = 40;
const PIXELS_PER_SEC = 100;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;

export const Timeline = forwardRef<HTMLDivElement, TimelineProps>(({
  project,
  currentTime,
  selectedAnimationId,
  isPlaying,
  isLooping,
  canUndo,
  canRedo,
  onTimeChange,
  onAnimationSelect,
  onProjectUpdate,
  onKeyframeSelect,
  onPlayPause,
  onStop,
  onLoopToggle,
  onUndo,
  onRedo,
  onSaveAnimAsTemplate
}, ref) => {
    
  // ========== 内部 UI 状态 ==========
  const [zoom, setZoom] = useState(1);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; animId: string } | null>(null);
  const [draggedItemIdx, setDraggedItemIdx] = useState<number | null>(null);
  const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>(null);
  
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // ========== 派生数据 ==========
  const currentAnimation = useMemo(() => {
    return project?.animations.find(a => a.id === selectedAnimationId);
  }, [project, selectedAnimationId]);

  // ========== 关键帧拖拽（复用 Hook）==========
  const handleKeyframeDragComplete = (keyframeId: string, newStartTime: number, newTrackId: number) => {
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

      onProjectUpdate(updatedProject);
  };

  const handleKeyframeSelectFromDrag = (keyframeId: string, targetLightIds: string[]) => {
      setSelectedKeyframeId(keyframeId);
      if (onKeyframeSelect) {
          onKeyframeSelect(keyframeId, targetLightIds);
      }
  };

  const { dragGhost, handleKeyframeMouseDown } = useKeyframeDrag(
      currentAnimation,
      zoom,
      handleKeyframeDragComplete,
      handleKeyframeSelectFromDrag
  );

  // ========== 上下文菜单 ==========
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
        if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
            setContextMenu(null);
        }
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const handleContextMenu = (e: React.MouseEvent, animId: string) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, animId });
  };

  // ========== 动画拖拽排序 ==========
  const handleDragStart = (e: React.DragEvent, idx: number) => {
      setDraggedItemIdx(idx);
      e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIdx: number) => {
      e.preventDefault();
      if (draggedItemIdx !== null && draggedItemIdx !== dropIdx && project) {
          const items = Array.from(project.animations);
          const [reorderedItem] = items.splice(draggedItemIdx, 1);
          items.splice(dropIdx, 0, reorderedItem);
          onProjectUpdate({ ...project, animations: items });
      }
      setDraggedItemIdx(null);
  };

  // ========== 动画 CRUD ==========
  const handleAddAnimation = () => {
      if (!project) return;
      const newAnimName = `灯效 ${project.animations.length + 1}`;
      const newAnim = { id: generateId(), name: newAnimName, keyframes: [], duration: 5000 };
      onProjectUpdate({
          ...project,
          animations: [...project.animations, newAnim]
      });
      onAnimationSelect(newAnim.id);
  };

  const handleRenameAnimation = (id: string, newName: string) => {
      if (!project) return;
      onProjectUpdate({
          ...project,
          animations: project.animations.map(a => a.id === id ? { ...a, name: newName } : a)
      });
  };

  const handleDeleteAnimation = (id: string) => {
      if (!project) return;
      if (project.animations.length <= 1) {
          alert("至少保留一个灯效");
          return;
      }
      if (!confirm("确定删除此灯效？")) return;
      
      const newAnims = project.animations.filter(a => a.id !== id);
      onProjectUpdate({
          ...project,
          animations: newAnims
      });
      if (selectedAnimationId === id) {
          onAnimationSelect(newAnims[0].id);
      }
  };

  // ========== 时间轴点击 ==========
  const handleTimelineClick = (e: React.MouseEvent) => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const scrollLeft = timelineRef.current.scrollLeft;
      const x = e.clientX - rect.left + scrollLeft;
      const newTime = Math.max(0, (x / (PIXELS_PER_SEC * zoom)) * 1000);
      onTimeChange(newTime);
  };

  // ========== 关键帧选择 ==========
  const handleSelectKeyframe = (id: string) => {
      setSelectedKeyframeId(id);
      const kf = currentAnimation?.keyframes.find(k => k.id === id);
      if (kf && onKeyframeSelect) {
          onKeyframeSelect(id, kf.targetLightIds);
      }
  };

  // ========== 单个动画播放 ==========
  const handlePlaySingleAnimation = (id: string) => {
      if (selectedAnimationId !== id) {
          onAnimationSelect(id);
          onTimeChange(0);
      }
      onPlayPause();
  };

  return (
    <div className="h-64 border-t bg-card flex flex-col shrink-0">
        
        {/* 时间轴控制栏 */}
        <div className="h-10 border-b flex items-center px-2 gap-2 bg-secondary/30">
            <Button size="icon" variant="ghost" onClick={onPlayPause} title="顺序播放所有灯效">
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <Button size="icon" variant="ghost" onClick={onStop}>
                <Square className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" className={cn(isLooping && "text-blue-500")} onClick={onLoopToggle} title="循环播放">
                <RotateCw className="w-4 h-4" />
            </Button>
            <div className="h-4 w-[1px] bg-border mx-2" />
            <div className="text-xs font-mono w-20">{(currentTime / 1000).toFixed(2)}s</div>
            
            <div className="flex-1" />
            
            <div className="flex items-center gap-2 mr-4">
                 <Button size="icon" variant="ghost" disabled={!canUndo} onClick={onUndo} title="撤销 (Ctrl+Z)">
                     <Undo2 className="w-4 h-4" />
                 </Button>
                 <Button size="icon" variant="ghost" disabled={!canRedo} onClick={onRedo} title="重做 (Ctrl+Y)">
                     <Redo2 className="w-4 h-4" />
                 </Button>
            </div>

            <div className="flex items-center gap-2">
                <span className="text-xs">缩放</span>
                <input 
                  type="range" min={MIN_ZOOM} max={MAX_ZOOM} step="0.1" value={zoom} 
                  onChange={e => setZoom(Number(e.target.value))} 
                  className="w-24"
                />
            </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
            {/* 灯效列表 */}
            <div className="w-56 border-r overflow-y-auto bg-secondary/10 flex flex-col">
                <div className="p-2 flex-1 space-y-1">
                    {project?.animations.map((anim, idx) => (
                        <div 
                          key={anim.id}
                          className={cn(
                              "flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer rounded-sm group relative",
                              selectedAnimationId === anim.id ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                          )}
                          onClick={() => onAnimationSelect(anim.id)}
                          onContextMenu={(e) => handleContextMenu(e, anim.id)}
                          draggable
                          onDragStart={(e) => handleDragStart(e, idx)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, idx)}
                        >
                            <div className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground">
                                <GripVertical size={12} />
                            </div>
                            
                            <div className="flex-1 truncate select-none font-medium">
                                {anim.name}
                            </div>

                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                                <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-6 w-6" 
                                    onClick={(e) => { 
                                        e.stopPropagation(); 
                                        handlePlaySingleAnimation(anim.id); 
                                    }}
                                    title="播放此灯效"
                                >
                                    {(isPlaying && selectedAnimationId === anim.id) ? <Pause size={14} /> : <Play size={14} />}
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-2 border-t bg-secondary/5">
                    <Button variant="ghost" size="sm" className="w-full justify-start text-xs text-muted-foreground" onClick={handleAddAnimation}>
                        <Plus className="w-3 h-3 mr-2" /> 添加灯效
                    </Button>
                </div>
            </div>

            {/* 轨道区域 */}
            <div 
              className="flex-1 overflow-x-auto relative cursor-pointer" 
              ref={timelineRef} 
              onClick={handleTimelineClick}
            >
                {/* 播放指针 */}
                <div 
                  className="absolute top-0 bottom-0 bg-red-500/50 w-[1px] z-20 pointer-events-none"
                  style={{ left: `${(currentTime / 1000) * PIXELS_PER_SEC * zoom}px` }}
                />
                
                {/* 标尺 */}
                <div className="h-6 border-b bg-secondary/20 sticky top-0 z-10 flex">
                     {Array.from({ length: Math.ceil((currentAnimation?.duration || 2000) / 1000) + 1 }).map((_, sec) => (
                         <div key={sec} className="border-l border-border/50 text-[10px] pl-1 text-muted-foreground select-none" style={{ width: `${PIXELS_PER_SEC * zoom}px`, flexShrink: 0 }}>
                             {sec}s
                         </div>
                     ))}
                </div>

                {/* 轨道 */}
                <div className="relative min-w-full h-full p-2">
                     {Array.from({ length: 6 }).map((_, trackIdx) => (
                         <div key={trackIdx} className="w-full border-b border-dashed border-border/30 relative" style={{ height: TRACK_HEIGHT }}>
                             <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/30 pointer-events-none">轨道 {trackIdx}</span>
                             
                             {/* Drag Ghost */}
                             {dragGhost && dragGhost.trackId === trackIdx && (
                                <div
                                    className="absolute top-1 bottom-1 rounded border-2 border-dashed border-primary bg-primary/40 shadow-[0_0_10px_rgba(var(--primary),0.3)] z-30 pointer-events-none"
                                    style={{
                                       left: `${(dragGhost.startTime / 1000) * PIXELS_PER_SEC * zoom}px`,
                                       width: `${(dragGhost.duration / 1000) * PIXELS_PER_SEC * zoom}px`
                                    }}
                                >
                                    <div className="absolute -top-5 left-0 text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap z-40">
                                        {(dragGhost.startTime / 1000).toFixed(2)}s
                                    </div>
                                </div>
                             )}

                             {currentAnimation?.keyframes.filter(k => k.trackId === trackIdx).map(k => (
                                 <div
                                   key={k.id}
                                   className={cn(
                                       "absolute top-1 bottom-1 rounded border overflow-hidden cursor-move group select-none transition-opacity duration-200",
                                       selectedKeyframeId === k.id ? "bg-blue-600 border-blue-400 z-10 shadow-sm" : "bg-secondary border-primary/20",
                                       (dragGhost && selectedKeyframeId === k.id) ? "opacity-40" : "opacity-100"
                                   )}
                                   style={{
                                       left: `${(k.startTime / 1000) * PIXELS_PER_SEC * zoom}px`,
                                       width: `${(k.duration / 1000) * PIXELS_PER_SEC * zoom}px`
                                   }}
                                   onMouseDown={(e) => handleKeyframeMouseDown(e, k)}
                                   onClick={(e) => { e.stopPropagation(); handleSelectKeyframe(k.id); }}
                                 >
                                     <div className="w-full h-full opacity-50" style={{ backgroundColor: k.toState.color }} />
                                     <div className="absolute inset-0 flex items-center justify-center text-[10px] text-white/90 font-mono truncate px-1 font-medium drop-shadow-md">
                                         {k.animationType}
                                     </div>
                                 </div>
                             ))}
                         </div>
                     ))}
                </div>
            </div>
        </div>
        
        {/* 上下文菜单 */}
        {contextMenu && (
            <div 
                ref={contextMenuRef}
                className="fixed bg-popover text-popover-foreground border shadow-md rounded-md z-50 w-40 py-1 flex flex-col"
                style={{ left: contextMenu.x, top: contextMenu.y }}
            >
                <button 
                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                    onClick={() => { 
                        const name = prompt("请输入新名称"); 
                        if (name) handleRenameAnimation(contextMenu.animId, name);
                        setContextMenu(null);
                    }}
                >
                    <PenLine size={14} /> 重命名
                </button>
                {onSaveAnimAsTemplate && (
                  <button 
                      className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                      onClick={() => {
                          onSaveAnimAsTemplate(contextMenu.animId);
                          setContextMenu(null);
                      }}
                  >
                      <Save size={14} /> 存为模板
                  </button>
                )}
                <div className="h-[1px] bg-border my-1" />
                <button 
                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left text-destructive"
                    onClick={() => {
                        handleDeleteAnimation(contextMenu.animId);
                        setContextMenu(null);
                    }}
                >
                    <Trash2 size={14} /> 删除
                </button>
            </div>
        )}
    </div>
  );
});
