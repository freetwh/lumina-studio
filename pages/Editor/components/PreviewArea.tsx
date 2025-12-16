
import React, { forwardRef, useMemo } from 'react';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../components/ui/utils';
import { LightGroup } from '../../../types';

interface PreviewAreaProps {
  lightGroup: LightGroup | null;
  selectedLightIds: Set<string>;
  selectionBox: { x: number; y: number; w: number; h: number } | null;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  getLightStyle: (nodeId: string) => React.CSSProperties;
  onMouseDown: (e: React.MouseEvent) => void;
  onLightClick: (e: React.MouseEvent, id: string) => void;
  onClearSelection: () => void;
  onSaveSelection: () => void;
}

export const PreviewArea = forwardRef<HTMLDivElement, PreviewAreaProps>(({
  lightGroup,
  selectedLightIds,
  selectionBox,
  zoom,
  onZoomChange,
  getLightStyle,
  onMouseDown,
  onLightClick,
  onClearSelection,
  onSaveSelection
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

  return (
    <div className="flex-1 bg-neutral-900 relative flex flex-col overflow-hidden">
       {/* 顶部工具栏 */}
       <div className="h-10 border-b border-neutral-800 flex items-center justify-between px-4 bg-black/40 shrink-0 z-10">
           <div className="text-xs text-neutral-400">预览视窗</div>
           <div className="flex items-center gap-2">
               <Button size="icon" variant="ghost" className="h-6 w-6 text-neutral-400" onClick={() => onZoomChange(Math.max(0.1, zoom - 0.1))}>
                   <ZoomOut size={14} />
               </Button>
               <span className="text-xs text-neutral-400 w-8 text-center">{Math.round(zoom * 100)}%</span>
               <Button size="icon" variant="ghost" className="h-6 w-6 text-neutral-400" onClick={() => onZoomChange(Math.min(3, zoom + 1))} title="Zoom In (Fast)">
                   <ZoomIn size={14} />
               </Button>
               <Button size="icon" variant="ghost" className="h-6 w-6 text-neutral-400 ml-2" onClick={() => onZoomChange(1)} title="重置缩放">
                   <Maximize size={14} />
               </Button>
           </div>
       </div>

       {/* 视口区域 - 整个区域都支持 MouseDown 触发框选 - 固定高度 600px */}
       <div 
         className="h-[600px] relative overflow-hidden flex items-center justify-center bg-[radial-gradient(#222_1px,transparent_1px)] [background-size:16px_16px] cursor-crosshair select-none shrink-0"
         onMouseDown={onMouseDown}
       >
           {lightGroup ? (
               <div 
                   style={{ 
                       transform: `scale(${zoom})`, 
                       transformOrigin: 'center center',
                       transition: 'transform 0.1s ease-out'
                   }}
               >
                   <div 
                      ref={ref}
                      className="relative"
                      style={containerStyle}
                   >
                       {/* 选框渲染 */}
                       {selectionBox && (
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
                                      // Hover effect only if node is large enough to see it clearly
                                      nodeSize > 8 && "hover:scale-125"
                                  )}
                                  style={{
                                      left: `${node.x}%`,
                                      top: `${node.y}%`,
                                      width: nodeSize,
                                      height: nodeSize,
                                      transform: 'translate(-50%, -50%)',
                                      ...style
                                  }}
                                  onMouseDown={(e) => onLightClick(e, node.id)}
                               />
                           );
                       })}
                   </div>
               </div>
           ) : (
               <div className="text-white">正在加载灯组...</div>
           )}
       </div>
       
       {/* 浮动操作按钮 */}
       <div className="absolute top-14 right-4 bg-black/50 p-2 rounded text-white flex gap-2 backdrop-blur-sm border border-white/10 z-20">
           <Button size="sm" variant="ghost" className="text-white hover:bg-white/20" onClick={onSaveSelection}>
              保存选区
           </Button>
           <div className="w-[1px] bg-white/20 mx-1" />
           <Button size="sm" variant="ghost" className="text-white hover:bg-white/20" onClick={onClearSelection}>
              清空选中 ({selectedLightIds.size})
           </Button>
       </div>

       <div className="absolute bottom-4 left-4 text-white/30 text-xs pointer-events-none bg-black/50 px-2 py-1 rounded z-20">
           按住 Shift 加选 / 按住 Alt 减选 / 拖拽框选
       </div>
    </div>
  );
});
