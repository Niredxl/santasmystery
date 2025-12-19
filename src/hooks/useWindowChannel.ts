import { useEffect, useCallback, useRef } from 'react';

export type CharacterEmotion = 'listening' | 'thinking' | 'happy' | 'sad' | 'neutral';

export interface GameState {
  isGameActive: boolean;
  currentWord: string;
  currentRiddle: string;
  hintsRemaining: number;
  hintsUsed: number;
  emotion: CharacterEmotion;
  statusText: string;
  customDisplay?: {
    type: 'image' | 'video' | 'text';
    content: string;
  };
  hintText?: string;
}

export interface ChannelMessage {
  type: 'game_state' | 'start_game' | 'give_hint' | 'set_emotion' | 'set_display' | 'mute' | 'ping' | 'pong' | 'ai_response';
  payload?: any;
}

const CHANNEL_NAME = 'christmas-riddle-game';

export function useWindowChannel(isAdmin: boolean) {
  const channelRef = useRef<BroadcastChannel | null>(null);
  const listenersRef = useRef<Map<string, Set<(payload: any) => void>>>(new Map());

  useEffect(() => {
    channelRef.current = new BroadcastChannel(CHANNEL_NAME);

    channelRef.current.onmessage = (event: MessageEvent<ChannelMessage>) => {
      const { type, payload } = event.data;
      const listeners = listenersRef.current.get(type);
      if (listeners) {
        listeners.forEach(callback => callback(payload));
      }
    };

    return () => {
      channelRef.current?.close();
    };
  }, []);

  const send = useCallback((message: ChannelMessage) => {
    channelRef.current?.postMessage(message);
  }, []);

  const subscribe = useCallback((type: string, callback: (payload: any) => void) => {
    if (!listenersRef.current.has(type)) {
      listenersRef.current.set(type, new Set());
    }
    listenersRef.current.get(type)!.add(callback);

    return () => {
      listenersRef.current.get(type)?.delete(callback);
    };
  }, []);

  const sendGameState = useCallback((state: GameState) => {
    send({ type: 'game_state', payload: state });
  }, [send]);

  const sendEmotion = useCallback((emotion: CharacterEmotion) => {
    send({ type: 'set_emotion', payload: emotion });
  }, [send]);

  const sendHint = useCallback((hint: string) => {
    send({ type: 'give_hint', payload: hint });
  }, [send]);

  const sendCustomDisplay = useCallback((display: GameState['customDisplay']) => {
    send({ type: 'set_display', payload: display });
  }, [send]);

  const sendMute = useCallback(() => {
    send({ type: 'mute' });
  }, [send]);

  const sendAIResponse = useCallback((response: string) => {
    send({ type: 'ai_response', payload: response });
  }, [send]);

  return {
    send,
    subscribe,
    sendGameState,
    sendEmotion,
    sendHint,
    sendCustomDisplay,
    sendMute,
    sendAIResponse,
  };
}

export function openUserDisplay() {
  const width = 800;
  const height = 600;
  const left = window.screen.width / 2 - width / 2;
  const top = window.screen.height / 2 - height / 2;

  return window.open(
    '/display',
    'ChristmasRiddleDisplay',
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no,status=no,menubar=no,toolbar=no`
  );
}
