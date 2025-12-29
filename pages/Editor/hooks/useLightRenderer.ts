import { useMemo } from 'react';
import { Animation } from '../../../types';
import { hexToRgb, lerp } from '../../../utils';

export interface UseLightRendererReturn {
    getLightStyle: (nodeId: string) => { backgroundColor: string; boxShadow: string };
}

/**
 * 灯光渲染 Hook
 * 根据当前动画和时间计算每个灯珠的样式
 */
export const useLightRenderer = (
    currentAnimation: Animation | undefined,
    currentTime: number
): UseLightRendererReturn => {
    const getLightStyle = useMemo(() => {
        return (nodeId: string) => {
            const baseR = 51; 
            const baseG = 51;
            const baseB = 51;
            const defaultStyle = { backgroundColor: `rgb(${baseR},${baseG},${baseB})`, boxShadow: 'none' };
            
            if (!currentAnimation) return defaultStyle; 
            
            // 1. 查找所有作用于当前节点且处于时间范围内的关键帧
            // 使用 < (startTime + duration) 确保如果一个动画在1000ms结束，另一个在1000ms开始，不会产生闪烁或双重计算
            const activeFrames = currentAnimation.keyframes.filter(k => 
                k.targetLightIds.includes(nodeId) && 
                currentTime > k.startTime && 
                currentTime < (k.startTime + k.duration)
            );

            // 2. 如果没有任何活跃的动画帧，返回默认样式（灭灯状态）
            // 这自然地实现了"播放完自动移除/重置"的需求
            if (activeFrames.length === 0) {
                return defaultStyle;
            }

            // 3. 处理多轨道冲突：按照 Track ID 排序，ID 越大层级越高（覆盖下层）
            activeFrames.sort((a, b) => a.trackId - b.trackId);
            
            // 4. 取最上层的一个作为最终渲染依据
            const activeFrame = activeFrames[activeFrames.length - 1];

            const progress = (currentTime - activeFrame.startTime) / activeFrame.duration;
            const p = Math.min(Math.max(progress, 0), 1);
            const fromColor = hexToRgb(activeFrame.fromState.color);
            const toColor = hexToRgb(activeFrame.toState.color);
            const frameR = lerp(fromColor.r, toColor.r, p);
            const frameG = lerp(fromColor.g, toColor.g, p);
            const frameB = lerp(fromColor.b, toColor.b, p);
            const fromBright = activeFrame.fromState.brightness ?? 0;
            const toBright = activeFrame.toState.brightness ?? 1;
            const brightness = lerp(fromBright, toBright, p);
            const r = Math.round(lerp(baseR, frameR, brightness));
            const g = Math.round(lerp(baseG, frameG, brightness));
            const b = Math.round(lerp(baseB, frameB, brightness));
            
            return {
                backgroundColor: `rgb(${r},${g},${b})`,
                boxShadow: brightness > 0.1 ? `0 0 ${15 * brightness}px rgba(${frameR},${frameG},${frameB}, ${0.8 * brightness})` : 'none'
            };
        };
    }, [currentAnimation, currentTime]);

    return {
        getLightStyle
    };
};

