
import React, { forwardRef } from 'react';
import { Play, Pause, Square, RotateCw, ChevronDown, Plus, Undo2, Redo2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../components/ui/utils';
import { Project, AnimationNode, Keyframe } from '../../../types';

interface TimelineProps {
  project: Project | null;
  currentAnimation?: AnimationNode;
  selectedAnimationId: string;
  selectedKeyframeId: string | null;
  currentTime: number;
  isPlaying: boolean;
  isLooping: boolean;
  zoom: number;
  canUndo: boolean;
  canRedo: boolean;
  dragGhost: { startTime: number; trackId: number; duration: number } | null;
  
  onPlayPause: () => void;
  onStop: () => void;
  onLoopToggle: () => void;
  onZoomChange: (z: number) => void;
  onSelectAnimation: (id: string) => void;
  onSelectKeyframe: (id: string) => void;
  onKeyframeMouseDown: (e: React.MouseEvent, k: Keyframe) => void;
  onTimelineClick: (e: React.MouseEvent) => void;
  onUndo: () => void;
  onRedo: () => void;
}

const TRACK_HEIGHT = 40;
const PIXELS_PER_SEC = 100;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;

export const Timeline = forwardRef<HTMLDivElement, TimelineProps>(({
  project,
  currentAnimation,
  selectedAnimationId,
  selectedKeyframeId,
  currentTime,
  isPlaying,
  isLooping,
  zoom,
  canUndo,
  canRedo,
  dragGhost,
  onPlayPause,
  onStop,
  onLoopToggle,
  onZoomChange,
  onSelectAnimation,
  onSelectKeyframe,
  onKeyframeMouseDown,
  onTimelineClick,
  onUndo,
  onRedo
}, ref) => {
  return (
    <div className="h-64 border-t bg-card flex flex-col shrink-0">
        
        {/* 时间轴控制栏 */}
        <div className="h-10 border-b flex items-center px-2 gap-2 bg-secondary/30">
            <Button size="icon" variant="ghost" onClick={onPlayPause}>
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <Button size="icon" variant="ghost" onClick={onStop}>
                <Square className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" className={cn(isLooping && "text-blue-500")} onClick={onLoopToggle}>
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
                  onChange={e => onZoomChange(Number(e.target.value))} 
                  className="w-24"
                />
            </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
            {/* 工程树结构 */}
            <div className="w-48 border-r overflow-y-auto bg-secondary/10">
                <div className="p-2">
                    <div className="flex items-center gap-1 font-semibold text-sm mb-2">
                        <ChevronDown size={14} /> 工程根节点
                    </div>
                    {project?.animations.map(anim => (
                        <div 
                          key={anim.id} 
                          className={cn(
                              "flex items-center gap-2 px-4 py-1.5 text-sm cursor-pointer hover:bg-accent rounded-sm",
                              selectedAnimationId === anim.id && "bg-accent text-accent-foreground"
                          )}
                          onClick={() => onSelectAnimation(anim.id)}
                        >
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            {anim.name}
                        </div>
                    ))}
                    <Button variant="ghost" size="sm" className="w-full mt-2 justify-start text-xs text-muted-foreground">
                        <Plus className="w-3 h-3 mr-2" /> 添加动画轨道
                    </Button>
                </div>
            </div>

            {/* 轨道区域 */}
            <div 
              className="flex-1 overflow-x-auto relative cursor-pointer" 
              ref={ref} 
              onClick={onTimelineClick}
            >
                {/* 播放指针 */}
                <div 
                  className="absolute top-0 bottom-0 bg-red-500/50 w-[1px] z-20 pointer-events-none"
                  style={{ left: `${(currentTime / 1000) * PIXELS_PER_SEC * zoom}px` }}
                />
                
                {/* 标尺 */}
                <div className="h-6 border-b bg-secondary/20 sticky top-0 z-10 flex">
                     {Array.from({ length: Math.ceil((currentAnimation?.duration || 5000) / 1000) + 5 }).map((_, sec) => (
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
                             
                             {/* 渲染 Drag Ghost - 增强可见性 */}
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
                                       // 正在拖拽时，降低原元素的透明度，但保留一点可见性
                                       (dragGhost && selectedKeyframeId === k.id) ? "opacity-40" : "opacity-100"
                                   )}
                                   style={{
                                       left: `${(k.startTime / 1000) * PIXELS_PER_SEC * zoom}px`,
                                       width: `${(k.duration / 1000) * PIXELS_PER_SEC * zoom}px`
                                   }}
                                   onMouseDown={(e) => onKeyframeMouseDown(e, k)}
                                   onClick={(e) => { e.stopPropagation(); onSelectKeyframe(k.id); }}
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
    </div>
  );
});
