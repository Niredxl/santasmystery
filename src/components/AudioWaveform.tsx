import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface AudioWaveformProps {
  frequencyData: Uint8Array;
  isActive: boolean;
  className?: string;
  barCount?: number;
}

export function AudioWaveform({ 
  frequencyData, 
  isActive, 
  className,
  barCount = 32 
}: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const barWidth = width / barCount;
    const step = Math.floor(frequencyData.length / barCount);

    ctx.clearRect(0, 0, width, height);

    // Create gradient
    const gradient = ctx.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, 'hsl(142, 70%, 45%)');
    gradient.addColorStop(0.5, 'hsl(45, 93%, 47%)');
    gradient.addColorStop(1, 'hsl(0, 73%, 41%)');

    for (let i = 0; i < barCount; i++) {
      const value = frequencyData[i * step] || 0;
      const barHeight = isActive ? (value / 255) * height * 0.9 : height * 0.05;
      const x = i * barWidth;
      const y = height - barHeight;

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x + 2, y, barWidth - 4, barHeight, 4);
      ctx.fill();
    }
  }, [frequencyData, isActive, barCount]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={100}
      className={cn(
        'w-full max-w-md h-24 rounded-xl bg-card/50 backdrop-blur border border-border',
        className
      )}
    />
  );
}
