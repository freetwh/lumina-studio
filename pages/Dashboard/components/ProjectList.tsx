import React from 'react';
import { FolderOpen, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../../../components/ui/card';
import { Project } from '../../../types';

interface ProjectListProps {
  projects: Project[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

export const ProjectList: React.FC<ProjectListProps> = ({ projects, onOpen, onDelete }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {projects.map(project => (
          <Card key={project.id} className="hover:border-primary/50 transition-colors">
              <CardHeader>
                  <CardTitle className="flex justify-between items-center">
                      {project.name}
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}>
                          <Trash2 size={16} />
                      </Button>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">更新时间: {new Date(project.updatedAt).toLocaleDateString()}</p>
              </CardHeader>
              <CardContent>
                  <div className="h-32 bg-secondary/50 rounded-md flex items-center justify-center">
                      <FolderOpen className="text-muted-foreground w-12 h-12" />
                  </div>
              </CardContent>
              <CardFooter>
                  <Button className="w-full" onClick={() => onOpen(project.id)}>进入编辑</Button>
              </CardFooter>
          </Card>
      ))}
    </div>
  );
};