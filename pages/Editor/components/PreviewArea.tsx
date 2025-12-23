/**
 * PreviewArea 组件 - 灯光预览区域
 * 
 * 采用受控组件模式，复用 Hooks：
 * - useCanvasPan: 画布平移
 * - useSelectionBox: 框选逻辑（受控）
 * - useLightRenderer: 灯光渲染
 */

import React, { forwardRef, useMemo, useState, useRef, useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize, PlusCircle } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../components/ui/utils';
import { LightGroup, AnimationNode } from '../../../types';
import { useCanvasPan } from '../hooks/useCanvasPan';
import { useSelectionBox } from '../hooks/useSelectionBox';
import { useLightRenderer } from '../hooks/useLightRenderer';

interface PreviewAreaProps {
  lightGroup: LightGroup | null;
  currentAnimation: AnimationNode | undefined;
  currentTime: number;
  selectedLightIds: Set<string>;
  
  onSelectionChange: (ids: Set<string>) => void;
  onSaveSelection?: () => void;
  onCreateAnimation?: () => void;
}

export const PreviewArea = forwardRef<HTMLDivElement, PreviewAreaProps>(({
  lightGroup,
  currentAnimation,
  currentTime,
  selectedLightIds,
  onSelectionChange,
  onSaveSelection,
  onCreateAnimation
}, ref) => {
  
  // ========== 内部 UI 状态 ==========
  const [zoom, setZoom] = useState(1);
  
  const internalRef = useRef<HTMLDivElement>(null);
  const previewRef = (ref as React.RefObject<HTMLDivElement>) || internalRef;

  // ========== 复用 Hooks（受控模式）==========
  
  // 画布平移
  const { pan, isSpacePressed, handleMouseDown: handleCanvasPanMouseDown } = useCanvasPan();
  
  // 框选逻辑（受控）
  const { selectionBox, handlePreviewMouseDown: handleSelectionMouseDown, handleLightClick } = useSelectionBox({
      lightGroup,
      selectedLightIds,
      onSelectionChange
  });
  
  // 灯光渲染
  const { getLightStyle } = useLightRenderer(currentAnimation, currentTime);

  // ========== 容器尺寸计算 ==========
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
      
      const calculatedNodeSize = Math.max(8, Math.min(width / cols * 0.6, 24));
      
      return { 
          containerStyle: { width, height }, 
          nodeSize: calculatedNodeSize 
      };
  }, [lightGroup]);

  // ========== 鼠标按下处理（组合两个 Hook）==========
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
      handleCanvasPanMouseDown(e);
      handleSelectionMouseDown(e, previewRef, isSpacePressed);
  }, [handleCanvasPanMouseDown, handleSelectionMouseDown, previewRef, isSpacePressed]);

  // ========== 缩放控制 ==========
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.2, 2));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.2, 0.5));
  const handleZoomReset = () => { setZoom(1); };

  if (!lightGroup) {
      return (
          <div className="flex-1 flex items-center justify-center bg-secondary/5">
              <p className="text-muted-foreground">请先创建或选择灯光组</p>
          </div>
      );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-secondary/5 relative">
      {/* 工具栏 */}
      <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 bg-card/90 backdrop-blur-sm rounded-md p-1 border shadow-sm">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleZoomIn} title="放大">
              <ZoomIn className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleZoomOut} title="缩小">
              <ZoomOut className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleZoomReset} title="重置视图">
              <Maximize className="w-4 h-4" />
          </Button>
      </div>

      {/* 底部操作栏 */}
      {selectedLightIds.size > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-card/95 backdrop-blur-sm rounded-full px-4 py-2 border shadow-lg flex items-center gap-3">
            <span className="text-sm font-medium">已选中 {selectedLightIds.size} 个灯珠</span>
            <div className="w-[1px] h-4 bg-border" />
            {onSaveSelection && (
              <Button size="sm" variant="ghost" onClick={onSaveSelection}>
                  保存选区
              </Button>
            )}
            {onCreateAnimation && (
              <Button size="sm" onClick={onCreateAnimation}>
                  <PlusCircle className="w-4 h-4 mr-1" /> 创建动画
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => onSelectionChange(new Set())}>
                清空
            </Button>
        </div>
      )}

      {/* 画布区域 - 整个区域都支持交互 */}
      <div 
        className="flex-1 flex items-center justify-center overflow-hidden"
        onMouseDown={handleMouseDown}
      >
        <div 
          className={cn(
              "relative border rounded-lg bg-background/50 shadow-inner pointer-events-none",
              isSpacePressed ? "cursor-grab" : "cursor-crosshair"
          )}
          style={{ 
              width: `${containerStyle.width * zoom}px`, 
              height: `${containerStyle.height * zoom}px`,
              transform: `translate(${pan.x}px, ${pan.y}px)`
          }}
        >
          <div
            ref={previewRef}
            className="absolute inset-0 pointer-events-none"
            style={{ 
                width: `${containerStyle.width}px`, 
                height: `${containerStyle.height}px`,
                transform: `scale(${zoom})`,
                transformOrigin: 'top left'
            }}
          >
            {/* 框选矩形 */}
            {selectionBox && (
              <div 
                className="absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-none z-20"
                style={{
                    left: selectionBox.x,
                    top: selectionBox.y,
                    width: selectionBox.w,
                    height: selectionBox.h
                }}
              />
            )}

            {/* 灯珠节点 */}
            {lightGroup.nodes.map(node => {
              const x = (node.x / 100) * containerStyle.width;
              const y = (node.y / 100) * containerStyle.height;
              const isSelected = selectedLightIds.has(node.id);
              const lightStyle = getLightStyle(node.id);
              
              return (
                <div
                  key={node.id}
                  className={cn(
                      "absolute rounded-full cursor-pointer pointer-events-auto  cursor-pointer border-2 z-10",
                      "transition-all duration-75",
                      isSelected ? "border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" : "border-transparent"
                  )}
                  style={{
                      left: x - nodeSize / 2,
                      top: y - nodeSize / 2,
                      width: nodeSize,
                      height: nodeSize,
                      ...lightStyle
                  }}
                  onClick={(e) => handleLightClick(e, node.id)}
                  title={`灯珠 ${node.id}`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* 提示信息 */}
      {isSpacePressed && (
        <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-sm rounded px-3 py-1.5 border shadow-sm text-xs text-muted-foreground pointer-events-none">
          按住空格键拖拽画布
        </div>
      )}
    </div>
  );
});
