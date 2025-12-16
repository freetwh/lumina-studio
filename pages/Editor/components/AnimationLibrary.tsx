
import React from 'react';
import { MousePointer2, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { Template, SavedSelection } from '../../../types';

interface AnimationLibraryProps {
  templates: Template[];
  savedSelections?: SavedSelection[];
  hasSelection: boolean;
  onAddKeyframe: (type: string) => void;
  onApplyTemplate: (template: Template) => void;
  onRestoreSelection?: (ids: string[]) => void;
  onDeleteSelection?: (id: string) => void;
}

const ANIMATION_TYPES = [
    { label: '淡入淡出', type: 'fade' },
    { label: '脉冲', type: 'pulse' },
    { label: '闪光', type: 'flash' },
    { label: '频闪', type: 'strobe' }
];

export const AnimationLibrary: React.FC<AnimationLibraryProps> = ({ 
    templates, 
    savedSelections = [], 
    hasSelection, 
    onAddKeyframe, 
    onApplyTemplate,
    onRestoreSelection,
    onDeleteSelection
}) => {
  return (
    <div className="w-64 border-r bg-card flex flex-col shrink-0">
        <div className="p-4 border-b">
            <h3 className="font-semibold mb-2">基础动画</h3>
            <div className="grid grid-cols-2 gap-2">
                {ANIMATION_TYPES.map(anim => (
                    <Button 
                      key={anim.type} 
                      variant="outline" 
                      className="h-16 flex flex-col gap-1"
                      onClick={() => onAddKeyframe(anim.type)}
                      disabled={!hasSelection}
                    >
                        <div className="w-4 h-4 rounded-full bg-primary/50" />
                        <span className="text-xs">{anim.label}</span>
                    </Button>
                ))}
            </div>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto space-y-6">
             <div>
                <h3 className="font-semibold mb-2">选区记录</h3>
                {savedSelections.length === 0 && <div className="text-xs text-muted-foreground">暂无保存的选区</div>}
                <div className="space-y-2">
                    {savedSelections.map(sel => (
                        <div key={sel.id} className="flex items-center group">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="flex-1 justify-start text-xs overflow-hidden"
                                onClick={() => onRestoreSelection?.(sel.lightIds)}
                            >
                                <MousePointer2 className="w-3 h-3 mr-2 shrink-0" />
                                <span className="truncate">{sel.name}</span>
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => onDeleteSelection?.(sel.id)}
                            >
                                <Trash2 size={12} />
                            </Button>
                        </div>
                    ))}
                </div>
             </div>

             <div>
                <h3 className="font-semibold mb-2">模板库</h3>
                <div className="space-y-2">
                    {templates.map(t => (
                        <Card key={t.id} className="cursor-pointer hover:bg-accent" onClick={() => onApplyTemplate(t)}>
                            <CardContent className="p-3">
                                <div className="text-sm font-medium">{t.name}</div>
                                <div className="text-xs text-muted-foreground">{t.keyframes.length} 帧</div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
             </div>
        </div>
    </div>
  );
};
