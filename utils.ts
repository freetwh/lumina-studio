
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
    // 创建默认的灯组 (4行 x 16列)
    const rows = 4;
    const cols = 16;
    const defaultGroup: LightGroup = {
      id: generateId(),
      name: "默认 4x16 矩阵",
      createdAt: Date.now(),
      gridConfig: { rows, cols },
      nodes: []
    };

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // 计算坐标百分比
        const x = cols > 1 ? (c / (cols - 1)) * 100 : 50;
        const y = rows > 1 ? (r / (rows - 1)) * 100 : 50;
        
        defaultGroup.nodes.push({
          id: `node-${r}-${c}`,
          x,
          y,
          brightness: 1,
          color: '#ffffff'
        });
      }
    }
    data.lightGroups.push(defaultGroup);
    
    // 辅助函数：根据行列获取节点ID
    const getNodeIds = (r: number, c: number) => `node-${r}-${c}`;

    // 模板 1: 跑马灯 (Marquee)
    // 路径: 上边(左->右) -> 右边(上->下) -> 下边(右->左) -> 左边(下->上)
    const marqueeIds: string[] = [];
    // Top Row
    for(let c=0; c<cols; c++) marqueeIds.push(getNodeIds(0, c));
    // Right Col (excluding top)
    for(let r=1; r<rows; r++) marqueeIds.push(getNodeIds(r, cols-1));
    // Bottom Row (excluding right)
    for(let c=cols-2; c>=0; c--) marqueeIds.push(getNodeIds(rows-1, c));
    // Left Col (excluding bottom and top)
    for(let r=rows-2; r>0; r--) marqueeIds.push(getNodeIds(r, 0));

    const marqueeKeyframes = marqueeIds.map((id, index) => ({
         id: generateId(),
         trackId: 0,
         startTime: index * 50, // 50ms 间隔
         duration: 300,
         targetLightIds: [id],
         animationType: 'flash',
         fromState: { color: '#00ff00', brightness: 1 }, // 亮绿色
         toState: { color: '#00ff00', brightness: 0 }   // 淡出
    }));

    data.templates.push({
      id: generateId(),
      name: "跑马灯 (Marquee)",
      createdAt: Date.now(),
      keyframes: marqueeKeyframes,
      lightGroupId: defaultGroup.id
    });

    // 模板 2: 彩虹波浪 (Rainbow Wave)
    const waveKeyframes = [];
    const colors = ['#ff0000', '#ffa500', '#ffff00', '#008000', '#0000ff', '#4b0082', '#ee82ee'];
    
    for(let c=0; c<cols; c++) {
        const colNodeIds = [];
        for(let r=0; r<rows; r++) {
            colNodeIds.push(getNodeIds(r, c));
        }
        
        // 每一列创建一个关键帧
        waveKeyframes.push({
            id: generateId(),
            trackId: c % 5, // 轨道错开，避免视觉重叠拥挤
            startTime: c * 100,
            duration: 1000,
            targetLightIds: colNodeIds,
            animationType: 'fade',
            fromState: { color: colors[c % colors.length], brightness: 1 }, // 亮起
            toState: { color: colors[c % colors.length], brightness: 0 }    // 拖尾淡出
        });
    }

    data.templates.push({
      id: generateId(),
      name: "彩虹波浪 (Rainbow Wave)",
      createdAt: Date.now(),
      keyframes: waveKeyframes,
      lightGroupId: defaultGroup.id
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

// --- 动画关键帧生成函数 ---

/**
 * 为不同动画类型生成多个连贯的关键帧
 * @param type 动画类型: 'fade', 'pulse', 'flash', 'strobe'
 * @param baseStartTime 基础开始时间
 * @param baseDuration 基础时长
 * @param targetLightIds 目标灯珠ID数组
 * @param trackId 轨道ID
 * @param color 动画颜色
 */
export const generateAnimationKeyframes = (
  type: string,
  baseStartTime: number,
  baseDuration: number,
  targetLightIds: string[],
  trackId: number,
  color: string
): Array<{ 
  id: string; 
  trackId: number; 
  startTime: number; 
  duration: number; 
  targetLightIds: string[]; 
  animationType: string; 
  fromState: { color: string; brightness: number }; 
  toState: { color: string; brightness: number } 
}> => {
  const keyframes = [];
  const segmentCount = type === 'strobe' ? 8 : (type === 'pulse' ? 4 : 3); // 每种动画的分段数
  const segmentDuration = baseDuration / segmentCount;

  switch (type) {
    case 'fade': // 淡入淡出: 0 -> 1 -> 0
      keyframes.push({
        id: generateId(),
        trackId,
        startTime: baseStartTime,
        duration: segmentDuration,
        targetLightIds,
        animationType: 'fade',
        fromState: { color, brightness: 0 },
        toState: { color, brightness: 1 }
      });
      keyframes.push({
        id: generateId(),
        trackId,
        startTime: baseStartTime + segmentDuration,
        duration: segmentDuration,
        targetLightIds,
        animationType: 'fade',
        fromState: { color, brightness: 1 },
        toState: { color, brightness: 1 }
      });
      keyframes.push({
        id: generateId(),
        trackId,
        startTime: baseStartTime + segmentDuration * 2,
        duration: segmentDuration,
        targetLightIds,
        animationType: 'fade',
        fromState: { color, brightness: 1 },
        toState: { color, brightness: 0 }
      });
      break;

    case 'pulse': // 脉冲: 0.3 -> 1 -> 0.3 -> 1 -> 0.3
      keyframes.push({
        id: generateId(),
        trackId,
        startTime: baseStartTime,
        duration: segmentDuration,
        targetLightIds,
        animationType: 'pulse',
        fromState: { color, brightness: 0.3 },
        toState: { color, brightness: 1 }
      });
      keyframes.push({
        id: generateId(),
        trackId,
        startTime: baseStartTime + segmentDuration,
        duration: segmentDuration,
        targetLightIds,
        animationType: 'pulse',
        fromState: { color, brightness: 1 },
        toState: { color, brightness: 0.3 }
      });
      keyframes.push({
        id: generateId(),
        trackId,
        startTime: baseStartTime + segmentDuration * 2,
        duration: segmentDuration,
        targetLightIds,
        animationType: 'pulse',
        fromState: { color, brightness: 0.3 },
        toState: { color, brightness: 1 }
      });
      keyframes.push({
        id: generateId(),
        trackId,
        startTime: baseStartTime + segmentDuration * 3,
        duration: segmentDuration,
        targetLightIds,
        animationType: 'pulse',
        fromState: { color, brightness: 1 },
        toState: { color, brightness: 0.3 }
      });
      break;

    case 'flash': // 闪光: 瞬间亮起，短暂保持，快速熄灭
      keyframes.push({
        id: generateId(),
        trackId,
        startTime: baseStartTime,
        duration: segmentDuration * 0.2,
        targetLightIds,
        animationType: 'flash',
        fromState: { color, brightness: 0 },
        toState: { color, brightness: 1 }
      });
      keyframes.push({
        id: generateId(),
        trackId,
        startTime: baseStartTime + segmentDuration * 0.2,
        duration: segmentDuration * 0.6,
        targetLightIds,
        animationType: 'flash',
        fromState: { color, brightness: 1 },
        toState: { color, brightness: 1 }
      });
      keyframes.push({
        id: generateId(),
        trackId,
        startTime: baseStartTime + segmentDuration * 0.8,
        duration: segmentDuration * 0.2,
        targetLightIds,
        animationType: 'flash',
        fromState: { color, brightness: 1 },
        toState: { color, brightness: 0 }
      });
      break;

    case 'strobe': // 频闪: 快速闪烁多次
      const strobeOnDuration = segmentDuration * 0.3;
      const strobeOffDuration = segmentDuration * 0.7;
      for (let i = 0; i < segmentCount; i++) {
        // 亮起
        keyframes.push({
          id: generateId(),
          trackId,
          startTime: baseStartTime + i * segmentDuration,
          duration: strobeOnDuration,
          targetLightIds,
          animationType: 'strobe',
          fromState: { color, brightness: 0 },
          toState: { color, brightness: 1 }
        });
        // 熄灭
        keyframes.push({
          id: generateId(),
          trackId,
          startTime: baseStartTime + i * segmentDuration + strobeOnDuration,
          duration: strobeOffDuration,
          targetLightIds,
          animationType: 'strobe',
          fromState: { color, brightness: 1 },
          toState: { color, brightness: 0 }
        });
      }
      break;
  }

  return keyframes;
};
