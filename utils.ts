
import { AppData, LightGroup, Project, Template } from './types';

const STORAGE_KEY = 'lumina_studio_data_v1';

/**
 * 生成唯一的 ID
 */
export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
};

/**
 * 从本地存储获取应用数据
 */
export const getStorageData = (): AppData => {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) {
    try {
      const parsed = JSON.parse(data);
      return {
        projects: Array.isArray(parsed.projects) ? parsed.projects : [],
        templates: Array.isArray(parsed.templates) ? parsed.templates : [],
        lightGroups: Array.isArray(parsed.lightGroups) ? parsed.lightGroups : []
      };
    } catch (e) {
      console.error("无法解析存储的数据", e);
    }
  }
  return {
    projects: [],
    templates: [],
    lightGroups: []
  };
};

/**
 * 保存数据到本地存储
 */
export const saveStorageData = (data: AppData) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

/**
 * 初始化种子数据 (如果是第一次运行)
 */
export const seedInitialData = () => {
  const data = getStorageData();
  if (data.lightGroups.length === 0) {
    // 创建默认的灯组
    const defaultGroup: LightGroup = {
      id: generateId(),
      name: "默认 8x8 矩阵",
      createdAt: Date.now(),
      nodes: Array.from({ length: 64 }).map((_, i) => ({
        id: `node-${i}`,
        x: (i % 8) * 12 + 8,
        y: Math.floor(i / 8) * 12 + 8,
        brightness: 1,
        color: '#ffffff'
      }))
    };
    data.lightGroups.push(defaultGroup);
    
    // 创建一个基础模板
    data.templates.push({
      id: generateId(),
      name: "彩虹波浪",
      createdAt: Date.now(),
      keyframes: [
         {
             id: generateId(),
             trackId: 0,
             startTime: 0,
             duration: 1000,
             targetLightIds: defaultGroup.nodes.map(n => n.id),
             animationType: 'fade',
             fromState: { color: '#ff0000', brightness: 0 },
             toState: { color: '#0000ff', brightness: 1 }
         }
      ]
    });

    saveStorageData(data);
  }
};

/**
 * 触发 JSON 文件下载
 */
export const downloadJson = (data: any, filename: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * 读取本地文件并解析为 JSON
 */
export const readFileAsJson = (file: File): Promise<any> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        resolve(json);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
};

// --- 数学与颜色工具函数 ---

/**
 * 十六进制颜色转 RGB 对象
 */
export const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
};

/**
 * 线性插值函数
 * @param start 起始值
 * @param end 结束值
 * @param t 进度 (0-1)
 */
export const lerp = (start: number, end: number, t: number) => start * (1 - t) + end * t;
