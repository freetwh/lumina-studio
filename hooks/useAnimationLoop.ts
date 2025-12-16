
import { useState, useEffect, useRef } from 'react';

export const useAnimationLoop = (duration: number, isLooping: boolean, onFinish?: () => void) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  
  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | undefined>(undefined);

  const animate = (time: number) => {
    if (lastTimeRef.current !== undefined) {
      const deltaTime = time - lastTimeRef.current;
      setCurrentTime(prev => {
          let next = prev + deltaTime;
          if (next >= duration) {
              if (isLooping) {
                  return 0;
              } else {
                  // 这里的逻辑需要微调：如果提供了 onFinish，让上层决定是否停止
                  if (onFinish) {
                      // 我们先暂停内部循环，等待上层处理（比如切换动画）
                      // 但通常 onFinish 会导致 duration 变化或 currentTime 重置
                      // 这是一个副作用，需要在渲染周期外处理，所以这里不直接 return duration
                      // 但为了简单，我们先返回 duration，并在 useEffect 中触发 onFinish
                  } else {
                      setIsPlaying(false);
                  }
                  return duration;
              }
          }
          return next;
      });
    }
    lastTimeRef.current = time;
    if (isPlaying) {
        requestRef.current = requestAnimationFrame(animate);
    }
  };

  // 监听完成状态
  useEffect(() => {
      if (!isLooping && isPlaying && currentTime >= duration) {
          if (onFinish) {
              onFinish();
          } else {
              setIsPlaying(false);
          }
      }
  }, [currentTime, duration, isLooping, isPlaying, onFinish]);

  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = performance.now();
      requestRef.current = requestAnimationFrame(animate);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      lastTimeRef.current = undefined;
    }
    return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, isLooping, duration]);

  return { isPlaying, setIsPlaying, currentTime, setCurrentTime };
};
