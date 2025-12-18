import React from 'react';
import { cn } from '@/lib/utils';
import type { CharacterEmotion } from '@/hooks/useWindowChannel';

interface ChristmasCharacterProps {
  emotion: CharacterEmotion;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const emotionConfig = {
  listening: {
    face: '🎧',
    color: 'bg-emotion-listening',
    animation: 'animate-pulse-glow',
    label: 'Listening...',
  },
  thinking: {
    face: '🤔',
    color: 'bg-emotion-thinking',
    animation: 'animate-thinking',
    label: 'Thinking...',
  },
  happy: {
    face: '😊',
    color: 'bg-emotion-happy',
    animation: 'animate-bounce-gentle',
    label: 'Correct!',
  },
  sad: {
    face: '😕',
    color: 'bg-emotion-sad',
    animation: 'animate-wiggle',
    label: 'Try again!',
  },
  neutral: {
    face: '😐',
    color: 'bg-emotion-neutral',
    animation: '',
    label: 'Ready',
  },
};

const sizeConfig = {
  sm: 'w-24 h-24 text-5xl',
  md: 'w-40 h-40 text-7xl',
  lg: 'w-64 h-64 text-9xl',
};

export function ChristmasCharacter({ emotion, size = 'lg', className }: ChristmasCharacterProps) {
  const config = emotionConfig[emotion];
  const sizeClass = sizeConfig[size];

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      {/* Santa Hat */}
      <div className="relative">
        {/* Hat */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 z-10">
          <div className="relative">
            {/* Hat tip */}
            <div className="w-8 h-8 bg-christmas-red rounded-full absolute -top-6 right-0 border-4 border-christmas-snow" />
            {/* Hat cone */}
            <div 
              className="w-0 h-0 border-l-[50px] border-r-[50px] border-b-[60px] border-l-transparent border-r-transparent border-b-christmas-red"
              style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))' }}
            />
            {/* Hat brim */}
            <div className="w-32 h-6 bg-christmas-snow rounded-full absolute -bottom-2 left-1/2 -translate-x-1/2 shadow-lg" />
          </div>
        </div>

        {/* Face circle */}
        <div
          className={cn(
            'rounded-full flex items-center justify-center transition-all duration-500',
            'border-8 border-christmas-gold shadow-2xl',
            sizeClass,
            config.animation
          )}
          style={{
            background: `linear-gradient(135deg, hsl(30, 80%, 85%) 0%, hsl(30, 70%, 75%) 100%)`,
          }}
        >
          <span className="select-none">{config.face}</span>
        </div>

        {/* Glow effect based on emotion */}
        <div
          className={cn(
            'absolute inset-0 rounded-full transition-all duration-500 -z-10',
            emotion === 'happy' && 'glow-gold',
            emotion === 'listening' && 'glow-green',
            emotion === 'thinking' && 'glow-red',
          )}
          style={{ transform: 'scale(1.1)' }}
        />
      </div>

      {/* Status label */}
      <div
        className={cn(
          'px-6 py-2 rounded-full font-bold text-lg',
          'bg-card border-2 border-christmas-gold text-christmas-gold',
          'shadow-lg'
        )}
      >
        {config.label}
      </div>
    </div>
  );
}
