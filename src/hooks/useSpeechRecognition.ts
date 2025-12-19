import { useState, useCallback, useRef, useEffect } from 'react';

interface UseSpeechRecognitionOptions {
  onResult?: (transcript: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
  continuous?: boolean;
}

// Cross-browser speech recognition using MediaRecorder
// This captures audio for visualization and provides manual transcription via text input
// Works on all modern browsers (Chrome, Firefox, Safari, Edge)
export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const { onResult, onStart, onEnd, continuous = true } = options;
  const [isListening, setIsListening] = useState(false);
  const [isSupported] = useState(true); // MediaRecorder is widely supported
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isIntentionalStopRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startListening = useCallback(async () => {
    if (isListening) return;
    
    isIntentionalStopRef.current = false;

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      
      streamRef.current = stream;
      
      // Create MediaRecorder for audio capture
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') 
          ? 'audio/webm' 
          : 'audio/mp4'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.onstart = () => {
        setIsListening(true);
        onStart?.();
      };
      
      mediaRecorder.onstop = () => {
        setIsListening(false);
        onEnd?.();
        
        // Auto-restart if not intentionally stopped and continuous mode
        if (!isIntentionalStopRef.current && continuous && streamRef.current) {
          setTimeout(() => {
            if (!isIntentionalStopRef.current && mediaRecorderRef.current) {
              try {
                mediaRecorderRef.current.start();
              } catch (e) {
                console.warn('Could not restart recording:', e);
              }
            }
          }, 200);
        }
      };
      
      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setIsListening(false);
      };
      
      // Start recording
      mediaRecorder.start();
      
    } catch (err) {
      console.error('Microphone access denied:', err);
      setIsListening(false);
    }
  }, [isListening, continuous, onStart, onEnd]);

  const stopListening = useCallback(() => {
    isIntentionalStopRef.current = true;
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setIsListening(false);
  }, []);

  // Manual transcript submission (since we're not using cloud STT)
  const submitTranscript = useCallback((text: string) => {
    if (text.trim()) {
      onResult?.(text.trim());
    }
  }, [onResult]);

  const resetTranscript = useCallback(() => {
    // No-op for this implementation
  }, []);

  return {
    isListening,
    transcript: '', // Transcript comes from manual text input
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
    submitTranscript, // For manual text submission
  };
}
