import { useState, useEffect, useRef } from 'react';

export const useAnimationLoop = (duration: number, isLooping: boolean) => {
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
                  setIsPlaying(false);
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
