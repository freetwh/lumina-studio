
import React, { forwardRef, useMemo } from 'react';
import { ZoomIn, ZoomOut, Maximize, PlusCircle } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../components/ui/utils';
import { LightGroup } from '../../../types';

interface PreviewAreaProps {
  lightGroup: LightGroup | null;
  selectedLightIds: Set<string>;
  selectionBox: { x: number; y: number; w: number; h: number } | null;
  zoom: number;
  pan: { x: number; y: number };
  isSpacePressed: boolean;
  onZoomChange: (zoom: number) => void;
  getLightStyle: (nodeId: string) => React.CSSProperties;
  onMouseDown: (e: React.MouseEvent) => void;
  onLightClick: (e: React.MouseEvent, id: string) => void;
  onClearSelection: () => void;
  onSaveSelection: () => void;
  onCreateAnimation: () => void;
}

export const PreviewArea = forwardRef<HTMLDivElement, PreviewAreaProps>(({
  lightGroup,
  selectedLightIds,
  selectionBox,
  zoom,
  pan,
  isSpacePressed,
  onZoomChange,
  getLightStyle,
  onMouseDown,
  onLightClick,
  onClearSelection,
  onSaveSelection,
  onCreateAnimation
}, ref) => {
  
  // Calculate container dimensions based on grid aspect ratio
  const { containerStyle, nodeSize } = useMemo(() => {
      if (!lightGroup) return { containerStyle: { width: 500, height: 500 }, nodeSize: 16 };
      
      const rows = lightGroup.gridConfig?.rows || 8;
      const cols = lightGroup.gridConfig?.cols || 8;
      const ratio = cols / rows;
      
      const MAX_DIM = 600;
      let width, height;
      
      if (ratio > 1) {
          width = MAX_DIM;
          height = MAX_DIM / ratio;
      } else {
          height = MAX_DIM;
          width = MAX_DIM * ratio;
      }

      // Ensure a minimum size to prevent it from being too small to interact
      if (width < 200) { width = 200; height = 200 / ratio; }
      if (height < 200) { height = 200; width = 200 * ratio; }

      // Calculate node size to fit density
      const cellW = width / cols;
      const cellH = height / rows;
      const theoreticalSize = Math.min(cellW, cellH);
      const size = Math.max(4, Math.min(24, theoreticalSize * 0.7));

      return {
          containerStyle: { width, height },
          nodeSize: size
      };
  }, [lightGroup]);

  // 计算鼠标样式
  const cursorStyle = isSpacePressed 
    ? 'cursor-grab active:cursor-grabbing' 
    : 'cursor-crosshair';

  return (
    <div className="flex-1 bg-neutral-900 relative flex flex-col overflow-hidden">
       {/* 顶部工具栏 */}
       <div className="h-10 border-b border-neutral-800 flex items-center justify-between px-4 bg-black/40 shrink-0 z-10">
           <div className="text-xs text-neutral-400">预览视窗 (按住空格拖拽画布)</div>
           <div className="flex items-center gap-2">
               <Button size="icon" variant="ghost" className="h-6 w-6 text-neutral-400" onClick={() => onZoomChange(Math.max(0.1, zoom - 0.1))}>
                   <ZoomOut size={18} />
               </Button>
               <span className="text-xs text-neutral-400 w-8 text-center">{Math.round(zoom * 100)}%</span>
               <Button size="icon" variant="ghost" className="h-6 w-6 text-neutral-400" onClick={() => onZoomChange(Math.min(3, zoom + 0.1))} title="Zoom In">
                   <ZoomIn size={18} />
               </Button>
               <Button size="icon" variant="ghost" className="h-6 w-6 text-neutral-400 ml-2" onClick={() => onZoomChange(1)} title="重置缩放">
                   <Maximize size={18} />
               </Button>
           </div>
       </div>

       {/* 视口区域 */}
       <div 
         className={cn(
             "flex-1 relative overflow-hidden flex items-center justify-center bg-[radial-gradient(#222_1px,transparent_1px)] [background-size:16px_16px] select-none shrink-0",
             cursorStyle
         )}
         onMouseDown={onMouseDown}
       >
           {lightGroup ? (
               <div 
                   style={{ 
                       // 关键修改：先 Translate 再 Scale。
                       // 这样 Pan 的单位就是屏幕像素，Zoom 是基于中心点的缩放。
                       transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, 
                       transformOrigin: 'center center',
                       transition: isSpacePressed ? 'none' : 'transform 0.1s ease-out'
                   }}
               >
                   <div 
                      ref={ref}
                      className="relative bg-black/20" 
                      style={containerStyle}
                   >
                       {/* 选框渲染 (在 Grid 内部坐标系) */}
                       {selectionBox && !isSpacePressed && (
                           <div 
                              className="absolute border border-blue-500 bg-blue-500/20 z-20 pointer-events-none"
                              style={{
                                  left: selectionBox.x,
                                  top: selectionBox.y,
                                  width: selectionBox.w,
                                  height: selectionBox.h
                              }}
                           />
                       )}

                       {lightGroup.nodes?.map(node => {
                           const isSelected = selectedLightIds.has(node.id);
                           const style = getLightStyle(node.id);
                           return (
                               <div
                                  key={node.id}
                                  className={cn(
                                      "absolute rounded-full transition-all duration-75 cursor-pointer border-2 z-10",
                                      isSelected ? "border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" : "border-transparent",
                                      (nodeSize > 8 && !isSpacePressed) && "hover:scale-125"
                                  )}
                                  style={{
                                      left: `${node.x}%`,
                                      top: `${node.y}%`,
                                      width: nodeSize,
                                      height: nodeSize,
                                      transform: 'translate(-50%, -50%)',
                                      ...style
                                  }}
                                  onMouseDown={(e) => !isSpacePressed && onLightClick(e, node.id)}
                               />
                           );
                       })}
                   </div>
               </div>
           ) : (
               <div className="text-white">正在加载灯组...</div>
           )}
       </div>
       
       {/* 浮动操作按钮 - 仅在有选中灯珠时显示 */}
       {selectedLightIds.size > 0 && (
           <div className="absolute top-14 right-4 bg-black/50 p-2 rounded text-white flex gap-2 backdrop-blur-sm border border-white/10 z-20 animate-in fade-in zoom-in-95 duration-200">
               <Button 
                    size="sm" 
                    className="bg-primary hover:bg-primary/90 text-primary-foreground border-0 gap-1"
                    onClick={onCreateAnimation}
                    title="基于当前选中灯珠创建动画"
               >
                  <PlusCircle size={14} />
                  创建动画
               </Button>
               <div className="w-[1px] bg-white/20 mx-1" />
               <Button size="sm" variant="ghost" className="text-white hover:bg-white/20" onClick={onSaveSelection}>
                  保存选区
               </Button>
               <div className="w-[1px] bg-white/20 mx-1" />
               <Button size="sm" variant="ghost" className="text-white hover:bg-white/20" onClick={onClearSelection}>
                  清空选中 ({selectedLightIds.size})
               </Button>
           </div>
       )}

       <div className="absolute bottom-4 left-4 text-white/30 text-xs pointer-events-none bg-black/50 px-2 py-1 rounded z-20">
           按住 Shift 加选 / 按住 Alt 减选 / 按住空格拖拽 / 拖拽框选
       </div>
    </div>
  );
});
