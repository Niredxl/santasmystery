import { useState, useCallback, useRef, useEffect } from 'react';

interface UseAudioVisualizerOptions {
  fftSize?: number;
  smoothingTimeConstant?: number;
}

export function useAudioVisualizer(options: UseAudioVisualizerOptions = {}) {
  const { fftSize = 256, smoothingTimeConstant = 0.8 } = options;
  const [isActive, setIsActive] = useState(false);
  const [frequencyData, setFrequencyData] = useState<Uint8Array>(new Uint8Array(fftSize / 2));
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const updateFrequencyData = useCallback(() => {
    if (analyserRef.current) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      setFrequencyData(dataArray);
    }
    animationRef.current = requestAnimationFrame(updateFrequencyData);
  }, []);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = fftSize;
      analyserRef.current.smoothingTimeConstant = smoothingTimeConstant;
      
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);
      
      setIsActive(true);
      updateFrequencyData();
    } catch (error) {
      console.error('Failed to start audio visualizer:', error);
    }
  }, [fftSize, smoothingTimeConstant, updateFrequencyData]);

  const stop = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    analyserRef.current = null;
    setIsActive(false);
    setFrequencyData(new Uint8Array(fftSize / 2));
  }, [fftSize]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    isActive,
    frequencyData,
    start,
    stop,
  };
}
