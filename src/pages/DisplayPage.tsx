import React, { useState, useEffect, useCallback } from 'react';
import { ChristmasCharacter } from '@/components/ChristmasCharacter';
import { AudioWaveform } from '@/components/AudioWaveform';
import { useWindowChannel, GameState, CharacterEmotion } from '@/hooks/useWindowChannel';
import { useAudioVisualizer } from '@/hooks/useAudioVisualizer';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Mic } from 'lucide-react';

const DEFAULT_STATE: GameState = {
  isGameActive: false,
  currentWord: '',
  currentRiddle: '',
  hintsRemaining: 3,
  hintsUsed: 0,
  emotion: 'neutral',
  statusText: 'Waiting for game to start...',
};

export default function DisplayPage() {
  const [gameState, setGameState] = useState<GameState>(DEFAULT_STATE);
  const [showHint, setShowHint] = useState(false);
  const [hintText, setHintText] = useState('');
  const [aiResponse, setAIResponse] = useState('');
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  
  const { subscribe } = useWindowChannel(false);
  const { isActive: isVisualizerActive, frequencyData, start: startVisualizer, stop: stopVisualizer } = useAudioVisualizer();

  // Manual audio enable (required for user gesture in modern browsers)
  const handleEnableAudio = useCallback(async () => {
    try {
      setAudioError(null);
      await startVisualizer();
      setAudioEnabled(true);
    } catch (error) {
      console.error('Failed to enable audio:', error);
      setAudioError('Could not access microphone. Please allow microphone permissions.');
    }
  }, [startVisualizer]);

  // Auto-start visualizer when game becomes active (if already enabled)
  useEffect(() => {
    if (gameState.isGameActive && audioEnabled && !isVisualizerActive) {
      startVisualizer();
    } else if (!gameState.isGameActive && isVisualizerActive) {
      // Don't stop - keep audio running for smooth experience
    }
  }, [gameState.isGameActive, audioEnabled, isVisualizerActive, startVisualizer]);

  useEffect(() => {
    const unsubGameState = subscribe('game_state', (state: GameState) => {
      setGameState(state);
      if (state.hintText && state.hintText !== hintText) {
        setHintText(state.hintText);
        setShowHint(true);
        // Hide hint after 10 seconds
        setTimeout(() => setShowHint(false), 10000);
      }
    });

    const unsubEmotion = subscribe('set_emotion', (emotion: CharacterEmotion) => {
      setGameState(prev => ({ ...prev, emotion }));
    });

    const unsubHint = subscribe('give_hint', (hint: string) => {
      setHintText(hint);
      setShowHint(true);
      setTimeout(() => setShowHint(false), 10000);
    });

    const unsubDisplay = subscribe('set_display', (display: GameState['customDisplay']) => {
      setGameState(prev => ({ ...prev, customDisplay: display }));
    });

    const unsubAIResponse = subscribe('ai_response', (response: string) => {
      setAIResponse(response);
    });

    return () => {
      unsubGameState();
      unsubEmotion();
      unsubHint();
      unsubDisplay();
      unsubAIResponse();
    };
  }, [subscribe, hintText]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 snowfall overflow-hidden">
      {/* Decorative Christmas Lights */}
      <div className="fixed top-0 left-0 right-0 h-16 flex items-center justify-center gap-4 overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'w-4 h-6 rounded-full animate-pulse-glow',
              i % 4 === 0 && 'bg-christmas-red',
              i % 4 === 1 && 'bg-christmas-green',
              i % 4 === 2 && 'bg-christmas-gold',
              i % 4 === 3 && 'bg-christmas-snow',
            )}
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>

      {/* Main Content */}
      <div className="flex flex-col items-center gap-8 max-w-3xl w-full">
        {/* Custom Display Content */}
        {gameState.customDisplay && (
          <div className="w-full max-w-lg animate-fade-in">
            {gameState.customDisplay.type === 'text' && (
              <div className="bg-card/90 backdrop-blur border-2 border-christmas-gold rounded-xl p-6 text-center">
                <p className="text-2xl text-foreground">{gameState.customDisplay.content}</p>
              </div>
            )}
            {gameState.customDisplay.type === 'image' && (
              <img 
                src={gameState.customDisplay.content} 
                alt="Custom display" 
                className="w-full rounded-xl shadow-2xl border-4 border-christmas-gold"
              />
            )}
            {gameState.customDisplay.type === 'video' && (
              <video 
                src={gameState.customDisplay.content} 
                autoPlay 
                loop 
                muted 
                className="w-full rounded-xl shadow-2xl border-4 border-christmas-gold"
              />
            )}
          </div>
        )}

        {/* Character */}
        <ChristmasCharacter emotion={gameState.emotion} size="lg" />

        {/* Enable Audio Button (required for user gesture) */}
        {!audioEnabled && (
          <div className="flex flex-col items-center gap-2">
            <Button 
              onClick={handleEnableAudio}
              size="lg"
              className="bg-christmas-green hover:bg-christmas-green/80 animate-pulse"
            >
              <Mic className="mr-2 h-5 w-5" />
              Enable Microphone
            </Button>
            {audioError && (
              <p className="text-destructive text-sm">{audioError}</p>
            )}
            <p className="text-muted-foreground text-sm">Click to enable audio visualization</p>
          </div>
        )}

        {/* Audio Waveform */}
        {audioEnabled && gameState.isGameActive && (
          <AudioWaveform 
            frequencyData={frequencyData} 
            isActive={isVisualizerActive && gameState.emotion === 'listening'} 
          />
        )}

        {/* Status Text */}
        <div className="text-center space-y-4">
          <p className="text-xl text-muted-foreground">{gameState.statusText}</p>
          
          {/* Hint Display */}
          {showHint && hintText && (
            <div className="animate-fade-in bg-christmas-gold/20 border-2 border-christmas-gold rounded-xl p-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-2xl">💡</span>
                <span className="text-lg font-bold text-christmas-gold">HINT</span>
              </div>
              <p className="text-xl text-foreground">{hintText}</p>
            </div>
          )}

          {/* AI Response Display */}
          {aiResponse && gameState.isGameActive && (
            <div className="animate-fade-in bg-card/90 backdrop-blur border-2 border-christmas-green rounded-xl p-6 max-w-lg">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-2xl">🎅</span>
                <span className="text-lg font-bold text-christmas-green">Response</span>
              </div>
              <p className="text-lg text-foreground text-center">{aiResponse}</p>
            </div>
          )}

          {/* Game Status */}
          {!gameState.isGameActive && !gameState.customDisplay && (
            <div className="bg-card/80 backdrop-blur rounded-xl p-8 border border-border">
              <h2 className="text-3xl font-bold text-christmas-gold mb-4">🎄 Christmas Riddle Game 🎄</h2>
              <p className="text-lg text-muted-foreground">
                Waiting for the game to start...
              </p>
            </div>
          )}
        </div>

        {/* Hints Remaining Indicator */}
        {gameState.isGameActive && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Hints:</span>
            {Array.from({ length: gameState.hintsRemaining }).map((_, i) => (
              <span key={i} className="text-2xl animate-bounce-gentle" style={{ animationDelay: `${i * 0.1}s` }}>
                💡
              </span>
            ))}
            {gameState.hintsRemaining === 0 && (
              <span className="text-muted-foreground italic">No hints remaining</span>
            )}
          </div>
        )}
      </div>

      {/* Bottom Decorations */}
      <div className="fixed bottom-0 left-0 right-0 h-20 flex items-end justify-center overflow-hidden">
        <div className="flex gap-8">
          <span className="text-6xl">🎄</span>
          <span className="text-6xl">🎁</span>
          <span className="text-6xl">⛄</span>
          <span className="text-6xl">🎁</span>
          <span className="text-6xl">🎄</span>
        </div>
      </div>
    </div>
  );
}
