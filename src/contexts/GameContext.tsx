import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { CharacterEmotion, GameState } from '@/hooks/useWindowChannel';

export interface GameParams {
  difficulty: 'easy' | 'medium' | 'hard';
  hintsAllowed: number;
  wordList: string[];
}

interface GameContextType {
  // Game params
  params: GameParams;
  setParams: (params: GameParams) => void;
  
  // Game state
  gameState: GameState;
  updateGameState: (updates: Partial<GameState>) => void;
  
  // Game actions
  startGame: () => string; // Returns selected word
  endGame: () => void;
  useHint: () => boolean; // Returns false if no hints left
  setEmotion: (emotion: CharacterEmotion) => void;
  
  // Processing state
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
}

const DEFAULT_WORDS = [
  'snowflake', 'reindeer', 'mistletoe', 'gingerbread', 'candy cane',
  'ornament', 'sleigh', 'chimney', 'stockings', 'wreath',
  'nutcracker', 'eggnog', 'fruitcake', 'caroling', 'tinsel',
  'snowman', 'icicle', 'poinsettia', 'holly', 'bells',
  'presents', 'fireplace', 'sugarplum', 'angel', 'star',
];

const DEFAULT_PARAMS: GameParams = {
  difficulty: 'medium',
  hintsAllowed: 3,
  wordList: DEFAULT_WORDS,
};

const DEFAULT_GAME_STATE: GameState = {
  isGameActive: false,
  currentWord: '',
  currentRiddle: '',
  hintsRemaining: 3,
  hintsUsed: 0,
  emotion: 'neutral',
  statusText: 'Waiting to start...',
};

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [params, setParams] = useState<GameParams>(DEFAULT_PARAMS);
  const [gameState, setGameState] = useState<GameState>(DEFAULT_GAME_STATE);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  const usedWordsRef = useRef<Set<string>>(new Set());

  const updateGameState = useCallback((updates: Partial<GameState>) => {
    setGameState(prev => ({ ...prev, ...updates }));
  }, []);

  const startGame = useCallback(() => {
    // Select a random word that hasn't been used
    const availableWords = params.wordList.filter(w => !usedWordsRef.current.has(w));
    
    // Reset if all words used
    if (availableWords.length === 0) {
      usedWordsRef.current.clear();
    }
    
    const words = availableWords.length > 0 ? availableWords : params.wordList;
    const selectedWord = words[Math.floor(Math.random() * words.length)];
    usedWordsRef.current.add(selectedWord);

    setGameState({
      isGameActive: true,
      currentWord: selectedWord,
      currentRiddle: '',
      hintsRemaining: params.hintsAllowed,
      hintsUsed: 0,
      emotion: 'neutral',
      statusText: 'Generating riddle...',
    });

    return selectedWord;
  }, [params]);

  const endGame = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      isGameActive: false,
      emotion: 'neutral',
      statusText: 'Game ended',
    }));
  }, []);

  const useHint = useCallback(() => {
    if (gameState.hintsRemaining <= 0) return false;
    
    setGameState(prev => ({
      ...prev,
      hintsRemaining: prev.hintsRemaining - 1,
      hintsUsed: prev.hintsUsed + 1,
    }));
    
    return true;
  }, [gameState.hintsRemaining]);

  const setEmotion = useCallback((emotion: CharacterEmotion) => {
    setGameState(prev => ({ ...prev, emotion }));
  }, []);

  return (
    <GameContext.Provider
      value={{
        params,
        setParams,
        gameState,
        updateGameState,
        startGame,
        endGame,
        useHint,
        setEmotion,
        isProcessing,
        setIsProcessing,
        isMuted,
        setIsMuted,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
