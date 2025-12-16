import React from 'react';
import { Copy, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Keyframe } from '../../../types';

interface InspectorProps {
  selectedKeyframeId: string | null;
  currentKeyframe?: Keyframe;
  onUpdateKeyframe: (id: string, updates: Partial<Keyframe>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export const Inspector: React.FC<InspectorProps> = ({ 
  selectedKeyframeId, 
  currentKeyframe, 
  onUpdateKeyframe, 
  onDuplicate, 
  onDelete 
}) => {
  return (
    <div className="w-72 border-l bg-card p-4 overflow-y-auto shrink-0">
       <h3 className="font-semibold mb-4">属性面板</h3>
       {selectedKeyframeId && currentKeyframe ? (
           <div className="space-y-4">
               <div className="text-xs text-muted-foreground mb-2">关键帧 ID: {selectedKeyframeId.slice(0,8)}</div>
               
               <div className="space-y-2">
                   <Label>时长 (毫秒)</Label>
                   <div className="flex gap-2">
                      <Input 
                          type="number" 
                          value={currentKeyframe.duration} 
                          onChange={(e) => onUpdateKeyframe(selectedKeyframeId, { duration: Number(e.target.value) })}
                      />
                   </div>
                   {/* 变速条 */}
                   <input 
                      type="range" min="0.1" max="5" step="0.1"
                      defaultValue="1"
                      onChange={(e) => {
                          const ratio = Number(e.target.value);
                          onUpdateKeyframe(selectedKeyframeId, { duration: Math.floor(currentKeyframe.duration / ratio) });
                      }}
                      className="w-full"
                   />
               </div>
               
               {/* 起始状态 */}
               <div className="space-y-3 pt-2 border-t">
                  <Label className="text-xs text-muted-foreground uppercase">起始状态</Label>
                  <div className="grid grid-cols-2 gap-2">
                       <div className="space-y-1">
                           <Label>颜色</Label>
                           <Input 
                              type="color" 
                              value={currentKeyframe.fromState.color}
                              onChange={(e) => onUpdateKeyframe(selectedKeyframeId, { fromState: { ...currentKeyframe.fromState, color: e.target.value } })}
                              className="h-8 p-0"
                           />
                       </div>
                       <div className="space-y-1">
                           <Label>亮度</Label>
                           <input 
                              type="range" min="0" max="1" step="0.1"
                              value={currentKeyframe.fromState.brightness ?? 0}
                              onChange={(e) => onUpdateKeyframe(selectedKeyframeId, { fromState: { ...currentKeyframe.fromState, brightness: Number(e.target.value) } })}
                              className="w-full h-8"
                           />
                           <div className="text-xs text-right text-muted-foreground">{currentKeyframe.fromState.brightness ?? 0}</div>
                       </div>
                   </div>
               </div>

               {/* 结束状态 */}
               <div className="space-y-3 pt-2 border-t">
                  <Label className="text-xs text-muted-foreground uppercase">结束状态</Label>
                  <div className="grid grid-cols-2 gap-2">
                       <div className="space-y-1">
                           <Label>颜色</Label>
                           <Input 
                              type="color" 
                              value={currentKeyframe.toState.color}
                              onChange={(e) => onUpdateKeyframe(selectedKeyframeId, { toState: { ...currentKeyframe.toState, color: e.target.value } })}
                              className="h-8 p-0"
                           />
                       </div>
                       <div className="space-y-1">
                           <Label>亮度</Label>
                           <input 
                              type="range" min="0" max="1" step="0.1"
                              value={currentKeyframe.toState.brightness ?? 1}
                              onChange={(e) => onUpdateKeyframe(selectedKeyframeId, { toState: { ...currentKeyframe.toState, brightness: Number(e.target.value) } })}
                              className="w-full h-8"
                           />
                           <div className="text-xs text-right text-muted-foreground">{currentKeyframe.toState.brightness ?? 1}</div>
                       </div>
                   </div>
               </div>

               <div className="flex gap-2 pt-4 border-t">
                   <Button variant="outline" size="sm" onClick={onDuplicate}><Copy className="w-3 h-3 mr-2" /> 复制</Button>
                   <Button variant="destructive" size="sm" onClick={onDelete}><Trash2 className="w-3 h-3 mr-2" /> 删除</Button>
               </div>
           </div>
       ) : (
           <div className="text-sm text-muted-foreground">请选择关键帧以编辑属性。</div>
       )}
    </div>
  );
};