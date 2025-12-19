import { useState, useCallback, useRef, useEffect } from 'react';

interface UseSpeechRecognitionOptions {
  onResult?: (transcript: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
  continuous?: boolean;
  interimResults?: boolean;
}

type SpeechRecognitionType = typeof window.SpeechRecognition extends new () => infer T ? T : never;

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const { onResult, onStart, onEnd, continuous = true, interimResults = true } = options;
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isIntentionalStopRef = useRef(false);
  const lastResultTimeRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      onStart?.();
    };

    recognition.onend = () => {
      setIsListening(false);
      onEnd?.();
      
      // Auto-restart if not intentionally stopped (for robustness)
      if (!isIntentionalStopRef.current && recognitionRef.current) {
        restartTimeoutRef.current = setTimeout(() => {
          try {
            recognitionRef.current?.start();
          } catch (e) {
            // Already started or other error
          }
        }, 100);
      }
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          // Pick the best alternative with highest confidence
          let bestTranscript = result[0].transcript;
          let bestConfidence = result[0].confidence;
          
          for (let j = 1; j < result.length; j++) {
            if (result[j].confidence > bestConfidence) {
              bestConfidence = result[j].confidence;
              bestTranscript = result[j].transcript;
            }
          }
          finalTranscript += bestTranscript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      const currentTranscript = finalTranscript || interimTranscript;
      setTranscript(currentTranscript);

      if (finalTranscript) {
        const now = Date.now();
        // Debounce rapid results (within 300ms)
        if (now - lastResultTimeRef.current > 300) {
          lastResultTimeRef.current = now;
          onResult?.(finalTranscript.trim());
        }
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      
      // Handle specific errors with auto-recovery
      if (event.error === 'no-speech' || event.error === 'audio-capture' || event.error === 'network') {
        // These are recoverable - will auto-restart via onend
        setIsListening(false);
      } else if (event.error === 'aborted') {
        // Intentional abort, don't restart
        setIsListening(false);
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      isIntentionalStopRef.current = true;
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      recognition.abort();
    };
  }, [continuous, interimResults, onResult, onStart, onEnd]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      isIntentionalStopRef.current = false;
      setTranscript('');
      try {
        recognitionRef.current.start();
      } catch (e) {
        // Already started - try stopping and restarting
        try {
          recognitionRef.current.stop();
          setTimeout(() => {
            try {
              recognitionRef.current?.start();
            } catch (e2) {
              console.error('Failed to restart speech recognition');
            }
          }, 100);
        } catch (e2) {
          console.error('Failed to restart speech recognition');
        }
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    isIntentionalStopRef.current = true;
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
    }
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  };
}
