import { Keyframe } from '../../../types';

/**
 * 检测关键帧碰撞并计算吸附位置
 * @param newStartTime 拖拽后的新起始时间
 * @param duration 关键帧时长
 * @param newTrackId 目标轨道 ID
 * @param keyframeId 当前关键帧 ID（用于排除自身）
 * @param allKeyframes 所有关键帧
 * @returns 吸附后的起始时间
 */
export const detectCollisionAndSnap = (
    newStartTime: number,
    duration: number,
    newTrackId: number,
    keyframeId: string,
    allKeyframes: Keyframe[]
): number => {
    // 找出同轨道的其他关键帧
    const siblings = allKeyframes.filter(k => 
        k.id !== keyframeId && k.trackId === newTrackId
    );

    // 检测碰撞
    const collision = siblings.find(k => {
        const kEnd = k.startTime + k.duration;
        const dragEnd = newStartTime + duration;
        return newStartTime < kEnd && dragEnd > k.startTime;
    });

    if (collision) {
        // 计算两种吸附方案：碰撞帧之前 或 碰撞帧之后
        const kEnd = collision.startTime + collision.duration;
        const snapBefore = collision.startTime - duration;
        const snapAfter = kEnd;

        // 选择距离更近的方案
        if (Math.abs(newStartTime - snapBefore) < Math.abs(newStartTime - snapAfter)) {
            newStartTime = snapBefore;
        } else {
            newStartTime = snapAfter;
        }
    }
    
    // 确保不为负数
    return Math.max(0, newStartTime);
};

/**
 * 查找可用的轨道（无碰撞）
 * @param startTime 起始时间
 * @param duration 时长
 * @param currentKeyframes 当前动画的所有关键帧
 * @returns 可用的轨道 ID
 */
export const findAvailableTrack = (
    startTime: number,
    duration: number,
    currentKeyframes: Keyframe[]
): number => {
    let targetTrack = 0;
    let hasCollision = true;
    
    while (hasCollision) {
        hasCollision = currentKeyframes.some(k => 
            k.trackId === targetTrack && 
            !(k.startTime + k.duration <= startTime || k.startTime >= startTime + duration)
        );
        if (hasCollision) targetTrack++;
    }
    
    return targetTrack;
};

