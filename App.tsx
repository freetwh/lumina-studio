
import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard/index';
import Templates from './pages/Templates/index';
import LightGroups from './pages/LightGroups/index';
import Editor from './pages/Editor/index';
import { seedInitialData } from './utils';
import { ThemeProvider } from './components/ThemeProvider';
import { ToastProvider } from './components/ui/toast-context';

// Layout for main pages (Dashboard, etc.) with Navbar
const MainLayout = () => (
  <>
    <Navbar />
    <main className="flex-1 overflow-auto flex flex-col">
      <Outlet />
    </main>
  </>
);

export default function App() {
  useEffect(() => {
    seedInitialData();
  }, []);

  return (
    <ThemeProvider defaultTheme="light" storageKey="lumina-theme">
      <ToastProvider>
        <HashRouter>
          <div className="h-screen bg-background text-foreground flex flex-col transition-colors duration-300 overflow-hidden">
            <Routes>
              {/* Routes with Navbar */}
              <Route element={<MainLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/templates" element={<Templates />} />
                <Route path="/light-groups" element={<LightGroups />} />
              </Route>

              {/* Editor Route (No Navbar, takes full height) */}
              <Route path="/editor/:projectId" element={
                  <div className="flex-1 overflow-hidden flex flex-col h-full">
                      <Editor />
                  </div>
              } />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </HashRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}
