
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Library, Lightbulb, Download, Sun, Moon } from 'lucide-react';
import { Button } from './ui/button';
import { getStorageData, downloadJson } from '../utils';
import { useTheme } from './ThemeProvider';

export default function Navbar() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  // 导出所有数据为 JSON 备份
  const handleExportAll = () => {
    const data = getStorageData();
    downloadJson(data, `lumina-backup-${Date.now()}.json`);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
      isActive ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
    }`;

  return (
    <nav className="border-b bg-background sticky top-0 z-40">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div className="text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent cursor-pointer" onClick={() => navigate('/')}>
            Lumina Studio
          </div>
          <div className="flex items-center gap-2">
            <NavLink to="/" className={navClass}>
              <LayoutDashboard size={18} /> 工程列表
            </NavLink>
            <NavLink to="/templates" className={navClass}>
              <Library size={18} /> 模板库
            </NavLink>
            <NavLink to="/light-groups" className={navClass}>
              <Lightbulb size={18} /> 灯组管理
            </NavLink>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <Button variant="ghost" size="icon" onClick={toggleTheme} title={theme === 'dark' ? '切换浅色模式' : '切换深色模式'}>
             {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
           </Button>
          <Button variant="outline" size="sm" onClick={handleExportAll}>
            <Download className="mr-2 h-4 w-4" /> 一键导出
          </Button>
        </div>
      </div>
    </nav>
  );
}
