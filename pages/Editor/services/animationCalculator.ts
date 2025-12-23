import { Keyframe } from '../../../types';

/**
 * 计算动画时长
 * 返回所有关键帧结束时间的最大值，至少为 2000ms
 */
export const calculateDuration = (keyframes: Keyframe[]): number => {
    if (!keyframes || keyframes.length === 0) return 2000;
    const end = Math.max(0, ...keyframes.map(k => k.startTime + k.duration));
    return Math.max(end, 2000);
};

