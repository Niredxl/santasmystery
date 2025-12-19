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
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const accumulatedTranscriptRef = useRef<string>('');

  const clearRestartTimeout = useCallback(() => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
  }, []);

  const clearSilenceTimeout = useCallback(() => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
  }, []);

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
      
      // Auto-restart if not intentionally stopped
      if (!isIntentionalStopRef.current && recognitionRef.current) {
        clearRestartTimeout();
        restartTimeoutRef.current = setTimeout(() => {
          try {
            recognitionRef.current?.start();
          } catch (e) {
            // Already started or other error - retry after delay
            restartTimeoutRef.current = setTimeout(() => {
              try {
                recognitionRef.current?.start();
              } catch (e2) {
                console.error('Failed to restart speech recognition after retry');
              }
            }, 500);
          }
        }, 150);
      }
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          // Pick the best alternative
          let bestTranscript = result[0].transcript;
          let bestConfidence = result[0].confidence || 0;
          
          for (let j = 1; j < result.length; j++) {
            const altConfidence = result[j].confidence || 0;
            if (altConfidence > bestConfidence) {
              bestConfidence = altConfidence;
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
        // Accumulate transcript
        accumulatedTranscriptRef.current += ' ' + finalTranscript;
        
        // Reset silence timer - wait for pause in speech before sending
        clearSilenceTimeout();
        silenceTimeoutRef.current = setTimeout(() => {
          const fullTranscript = accumulatedTranscriptRef.current.trim();
          if (fullTranscript) {
            onResult?.(fullTranscript);
            accumulatedTranscriptRef.current = '';
          }
        }, 1500); // Wait 1.5s of silence before processing
      }
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      
      // Handle specific errors with auto-recovery
      if (event.error === 'no-speech') {
        // No speech detected - this is normal, just restart
        setIsListening(false);
      } else if (event.error === 'audio-capture') {
        // Microphone issue - wait longer before retry
        setIsListening(false);
        clearRestartTimeout();
        restartTimeoutRef.current = setTimeout(() => {
          if (!isIntentionalStopRef.current) {
            try {
              recognitionRef.current?.start();
            } catch (e) {
              console.error('Failed to restart after audio-capture error');
            }
          }
        }, 1000);
      } else if (event.error === 'network') {
        // Network issue - retry
        setIsListening(false);
      } else if (event.error === 'aborted') {
        // Intentional abort
        setIsListening(false);
      } else if (event.error === 'not-allowed') {
        // Permission denied
        setIsListening(false);
        setIsSupported(false);
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      isIntentionalStopRef.current = true;
      clearRestartTimeout();
      clearSilenceTimeout();
      recognition.abort();
    };
  }, [continuous, interimResults, onResult, onStart, onEnd, clearRestartTimeout, clearSilenceTimeout]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      isIntentionalStopRef.current = false;
      setTranscript('');
      accumulatedTranscriptRef.current = '';
      
      // Request microphone permission first
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => {
          try {
            recognitionRef.current?.start();
          } catch (e) {
            // Already started - stop and restart
            try {
              recognitionRef.current?.stop();
              setTimeout(() => {
                try {
                  recognitionRef.current?.start();
                } catch (e2) {
                  console.error('Failed to restart speech recognition');
                }
              }, 200);
            } catch (e2) {
              console.error('Failed to restart speech recognition');
            }
          }
        })
        .catch((err) => {
          console.error('Microphone permission denied:', err);
          setIsSupported(false);
        });
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    isIntentionalStopRef.current = true;
    clearRestartTimeout();
    clearSilenceTimeout();
    
    // Send any accumulated transcript
    const fullTranscript = accumulatedTranscriptRef.current.trim();
    if (fullTranscript) {
      onResult?.(fullTranscript);
      accumulatedTranscriptRef.current = '';
    }
    
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening, clearRestartTimeout, clearSilenceTimeout, onResult]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    accumulatedTranscriptRef.current = '';
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
