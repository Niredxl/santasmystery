import { useState, useCallback, useRef, useEffect } from 'react';

interface UsePiperTTSOptions {
  onStart?: () => void;
  onEnd?: () => void;
  voiceId?: string;
}

export function usePiperTTS(options: UsePiperTTSOptions = {}) {
  const { 
    onStart, 
    onEnd, 
    voiceId = 'en_US-norman-medium' 
  } = options;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPiperReady, setIsPiperReady] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [useFallback, setUseFallback] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsRef = useRef<typeof import('@mintplex-labs/piper-tts-web') | null>(null);

  // Initialize Piper TTS
  useEffect(() => {
    const initPiper = async () => {
      try {
        const tts = await import('@mintplex-labs/piper-tts-web');
        ttsRef.current = tts;
        
        // Check if voice is already downloaded
        const stored = await tts.stored();
        if (!stored.includes(voiceId)) {
          console.log(`Downloading Piper voice: ${voiceId}...`);
          setIsLoading(true);
          await tts.download(voiceId, (progress: { loaded: number; total: number }) => {
            const pct = Math.round((progress.loaded * 100) / progress.total);
            setDownloadProgress(pct);
          });
          setIsLoading(false);
        }
        
        setIsPiperReady(true);
        console.log('Piper TTS ready with voice:', voiceId);
      } catch (error) {
        console.warn('Piper TTS failed to initialize, will use fallback:', error);
        setUseFallback(true);
      }
    };

    initPiper();

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [voiceId]);

  const speakWithPiper = useCallback(async (text: string) => {
    if (!ttsRef.current || !isPiperReady) {
      throw new Error('Piper TTS not ready');
    }

    setIsSpeaking(true);
    onStart?.();

    try {
      const wav = await ttsRef.current.predict({
        text,
        voiceId,
      });

      const audio = new Audio();
      audio.src = URL.createObjectURL(wav);
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audio.src);
        audioRef.current = null;
        onEnd?.();
      };

      audio.onerror = (e) => {
        console.error('Audio playback error:', e);
        setIsSpeaking(false);
        audioRef.current = null;
        onEnd?.();
      };

      await audio.play();
    } catch (error) {
      console.error('Piper TTS error:', error);
      setIsSpeaking(false);
      throw error;
    }
  }, [isPiperReady, voiceId, onStart, onEnd]);

  const speakWithBrowser = useCallback((text: string) => {
    if (!window.speechSynthesis) {
      console.error('Browser speech synthesis not supported');
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.85;
    utterance.pitch = 0.7;
    utterance.volume = 1;

    // Try to find an English voice
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => v.lang.startsWith('en'));
    if (englishVoice) utterance.voice = englishVoice;

    utterance.onstart = () => {
      setIsSpeaking(true);
      onStart?.();
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      onEnd?.();
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
  }, [onStart, onEnd]);

  const speak = useCallback(async (text: string) => {
    if (useFallback || !isPiperReady) {
      speakWithBrowser(text);
      return;
    }

    try {
      await speakWithPiper(text);
    } catch (error) {
      console.warn('Piper TTS failed, falling back to browser:', error);
      speakWithBrowser(text);
    }
  }, [useFallback, isPiperReady, speakWithPiper, speakWithBrowser]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  return {
    speak,
    stop,
    isSpeaking,
    isLoading,
    isPiperReady,
    useFallback,
    downloadProgress,
    voiceId,
  };
}
