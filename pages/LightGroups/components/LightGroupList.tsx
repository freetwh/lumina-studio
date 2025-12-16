
import React from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { LightGroup } from '../../../types';

interface LightGroupListProps {
  groups: LightGroup[];
  onDelete: (id: string) => void;
}

export const LightGroupList: React.FC<LightGroupListProps> = ({ groups, onDelete }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {groups.map(group => {
          const rows = group.gridConfig?.rows || 8;
          const cols = group.gridConfig?.cols || 8;
          // Calculate Aspect Ratio
          const ratio = cols / rows;
          
          return (
            <Card key={group.id}>
                <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                        {group.name}
                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => onDelete(group.id)}>
                            <Trash2 size={16} />
                        </Button>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-40 bg-black/90 rounded-md relative flex items-center justify-center overflow-hidden p-4">
                        <div 
                            className="relative"
                            style={{
                                width: ratio >= 1 ? '100%' : `${ratio * 100}%`,
                                aspectRatio: `${ratio}`,
                                maxHeight: '100%'
                            }}
                        >
                            {/* Only render up to 256 nodes for preview performance */}
                            {group.nodes?.slice(0, 256).map((node, i) => (
                                <div 
                                    key={i} 
                                    className="absolute rounded-full bg-white/60"
                                    style={{
                                        left: `${node.x}%`,
                                        top: `${node.y}%`,
                                        transform: 'translate(-50%, -50%)',
                                        width: `max(2px, ${240 / Math.max(cols * 1.5, rows * 1.5)}px)`,
                                        height: `max(2px, ${240 / Math.max(cols * 1.5, rows * 1.5)}px)`
                                    }} 
                                />
                            ))}
                        </div>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                        {group.nodes?.length || 0} 灯珠 
                        {group.gridConfig ? ` (${group.gridConfig.rows}x${group.gridConfig.cols})` : ''}
                    </p>
                </CardContent>
            </Card>
          );
      })}
    </div>
  );
};
