import { useState, useCallback, useRef, useEffect } from 'react';

interface UseSpeechSynthesisOptions {
  onStart?: () => void;
  onEnd?: () => void;
  rate?: number;
  pitch?: number;
  volume?: number;
}

export function useSpeechSynthesis(options: UseSpeechSynthesisOptions = {}) {
  // Santa-like voice settings: lower pitch, slower rate
  const { onStart, onEnd, rate = 0.85, pitch = 0.7, volume = 1 } = options;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setIsSupported(false);
      return;
    }

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const speak = useCallback((text: string, voiceName?: string) => {
    if (!window.speechSynthesis) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    // Add Santa-like flair to the text
    const santaText = text;

    const utterance = new SpeechSynthesisUtterance(santaText);
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    // Find a deep male voice for Santa-like effect
    if (voiceName) {
      const voice = voices.find(v => v.name === voiceName);
      if (voice) utterance.voice = voice;
    } else {
      // Prefer deeper male voices for Santa effect
      const preferredVoices = [
        'Google UK English Male',
        'Microsoft David',
        'Daniel',
        'Alex',
        'Fred',
        'Google US English',
      ];
      
      let selectedVoice = null;
      for (const preferred of preferredVoices) {
        selectedVoice = voices.find(v => v.name.includes(preferred));
        if (selectedVoice) break;
      }
      
      // Fallback to any male English voice
      if (!selectedVoice) {
        selectedVoice = voices.find(v => 
          v.lang.startsWith('en') && 
          (v.name.toLowerCase().includes('male') || 
           v.name.includes('David') || 
           v.name.includes('Daniel') ||
           v.name.includes('James'))
        );
      }
      
      // Final fallback to any English voice
      if (!selectedVoice) {
        selectedVoice = voices.find(v => v.lang.startsWith('en'));
      }
      
      if (selectedVoice) utterance.voice = selectedVoice;
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
      onStart?.();
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      onEnd?.();
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event.error);
      setIsSpeaking(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [rate, pitch, volume, voices, onStart, onEnd]);

  const stop = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  const pause = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.pause();
    }
  }, []);

  const resume = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.resume();
    }
  }, []);

  return {
    isSpeaking,
    isSupported,
    voices,
    speak,
    stop,
    pause,
    resume,
  };
}
