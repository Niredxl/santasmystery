import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { 
  Play, 
  Square, 
  Mic, 
  MicOff, 
  Lightbulb, 
  Settings, 
  Monitor, 
  Smile, 
  Frown, 
  Meh, 
  HelpCircle,
  Headphones,
  ExternalLink,
  Volume2,
  VolumeX,
  Send,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useGame, GameParams } from '@/contexts/GameContext';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { usePiperTTS } from '@/hooks/usePiperTTS';
import { useLMStudio } from '@/hooks/useLMStudio';
import { useWindowChannel, openUserDisplay, CharacterEmotion } from '@/hooks/useWindowChannel';
import { ChristmasCharacter } from '@/components/ChristmasCharacter';

const DEFAULT_WORDS = [
  'snowflake', 'reindeer', 'mistletoe', 'gingerbread', 'candy cane',
  'ornament', 'sleigh', 'chimney', 'stockings', 'wreath',
  'nutcracker', 'eggnog', 'fruitcake', 'caroling', 'tinsel',
  'snowman', 'icicle', 'poinsettia', 'holly', 'bells',
  'presents', 'fireplace', 'sugarplum', 'angel', 'star',
];

export default function AdminPage() {
  const { 
    params, setParams, 
    gameState, updateGameState, 
    startGame, endGame, useHint, setEmotion,
    isProcessing, setIsProcessing,
    isMuted, setIsMuted
  } = useGame();

  const [displayWindow, setDisplayWindow] = useState<Window | null>(null);
  const [customDisplayType, setCustomDisplayType] = useState<'text' | 'image' | 'video'>('text');
  const [customDisplayContent, setCustomDisplayContent] = useState('');
  const [tempWordList, setTempWordList] = useState(params.wordList.join('\n'));
  const [backupTextInput, setBackupTextInput] = useState('');
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [lastAIResponse, setLastAIResponse] = useState<string>('');
  const processingQueueRef = useRef<string[]>([]);
  const isProcessingRef = useRef(false);

  const { sendGameState, sendEmotion, sendHint, sendCustomDisplay, sendMute, sendAIResponse } = useWindowChannel(true);
  const { generateRiddle, handleUserInput, generateHint, isLoading: isLMLoading } = useLMStudio();
  const { speak, stop: stopSpeaking, isSpeaking, isPiperReady, useFallback, downloadProgress, isLoading: isTTSLoading } = usePiperTTS({
    onEnd: () => {
      // After speaking, go back to listening if game is active
      if (gameState.isGameActive && !isMuted) {
        setEmotion('listening');
        startListening();
      }
    }
  });

  const processNextInQueue = useCallback(async () => {
    if (isProcessingRef.current || processingQueueRef.current.length === 0) return;
    if (!gameState.isGameActive || isMuted) return;

    isProcessingRef.current = true;
    const userInput = processingQueueRef.current.shift()!;

    setEmotion('thinking');
    setIsProcessing(true);
    updateGameState({ statusText: `Processing: "${userInput}"` });

    try {
      const { isCorrect, response, isQuestion } = await handleUserInput(
        gameState.currentWord,
        userInput,
        gameState.currentRiddle
      );

      setLastAIResponse(response);
      sendAIResponse(response);
      
      if (isQuestion) {
        // It was a question, show the answer
        setEmotion('neutral');
        updateGameState({ statusText: 'Answered your question!' });
        speak(response);
      } else if (isCorrect) {
        setEmotion('happy');
        updateGameState({ statusText: 'Correct! 🎉' });
        speak(`Correct! ${response}`);
        // End game after correct answer
        setTimeout(() => endGame(), 5000);
      } else {
        setEmotion('sad');
        updateGameState({ statusText: 'Try again!' });
        speak(response);
      }
    } catch (error) {
      toast({
        title: 'LM Studio Error',
        description: 'Could not connect to LM Studio. Make sure it\'s running on localhost:1234',
        variant: 'destructive',
      });
      setEmotion('neutral');
    } finally {
      setIsProcessing(false);
      isProcessingRef.current = false;
      // Process next in queue
      setTimeout(processNextInQueue, 100);
    }
  }, [gameState.isGameActive, gameState.currentWord, gameState.currentRiddle, isMuted, handleUserInput, setEmotion, setIsProcessing, updateGameState, speak, endGame, sendAIResponse]);

  const { isListening, startListening, stopListening, isSupported: speechSupported } = useSpeechRecognition({
    onResult: (transcript) => {
      if (gameState.isGameActive && !isMuted && !isSpeaking) {
        processingQueueRef.current.push(transcript);
        processNextInQueue();
      }
    },
    onStart: () => {
      if (!isSpeaking && !isProcessing) {
        setEmotion('listening');
        updateGameState({ statusText: 'Listening...' });
      }
    },
  });

  // Fetch available audio devices
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        // Request permission first to get device labels
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(d => d.kind === 'audioinput');
        setAudioDevices(audioInputs);
        if (audioInputs.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(audioInputs[0].deviceId);
        }
      } catch (err) {
        console.error('Could not enumerate devices:', err);
      }
    };
    fetchDevices();

    // Listen for device changes
    navigator.mediaDevices.addEventListener('devicechange', fetchDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', fetchDevices);
    };
  }, [selectedDeviceId]);

  // Sync game state to user display window
  useEffect(() => {
    sendGameState(gameState);
  }, [gameState, sendGameState]);

  const handleOpenDisplay = () => {
    const win = openUserDisplay();
    setDisplayWindow(win);
    toast({ title: 'Display window opened', description: 'User display is now active' });
  };

  const handleStartGame = async () => {
    const word = startGame();
    updateGameState({ statusText: 'Generating riddle...' });
    
    try {
      const riddle = await generateRiddle(word, params.difficulty);
      updateGameState({ 
        currentRiddle: riddle, 
        statusText: 'Game started! Listening...' 
      });
      
      // Speak the riddle
      speak(`Here's your riddle: ${riddle}`);
      setEmotion('neutral');
      
      toast({ title: 'Game Started!', description: `Secret word selected` });
    } catch (error) {
      toast({
        title: 'Error generating riddle',
        description: 'Check LM Studio connection',
        variant: 'destructive',
      });
      endGame();
    }
  };

  const handleStopGame = () => {
    endGame();
    stopListening();
    stopSpeaking();
    setEmotion('neutral');
    processingQueueRef.current = [];
    toast({ title: 'Game ended' });
  };

  const handleMuteToggle = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    
    if (newMuted) {
      stopListening();
      stopSpeaking();
      processingQueueRef.current = [];
      sendMute();
      toast({ title: 'Muted', description: 'Bot will not respond to speech' });
    } else {
      if (gameState.isGameActive) {
        startListening();
        setEmotion('listening');
      }
      toast({ title: 'Unmuted', description: 'Bot is listening again' });
    }
  };

  const handleGiveHint = async () => {
    if (!useHint()) {
      toast({ title: 'No hints remaining!', variant: 'destructive' });
      return;
    }

    try {
      const hint = await generateHint(
        gameState.currentWord,
        gameState.currentRiddle,
        gameState.hintsUsed + 1
      );
      
      updateGameState({ hintText: hint });
      sendHint(hint);
      speak(`Here's a hint: ${hint}`);
      
      toast({ title: 'Hint given', description: `${gameState.hintsRemaining - 1} hints remaining` });
    } catch (error) {
      toast({ title: 'Error generating hint', variant: 'destructive' });
    }
  };

  const handleSetDisplay = () => {
    const display = {
      type: customDisplayType,
      content: customDisplayContent,
    };
    updateGameState({ customDisplay: display });
    sendCustomDisplay(display);
    toast({ title: 'Display updated' });
  };

  const handleManualEmotion = (emotion: CharacterEmotion) => {
    setEmotion(emotion);
    sendEmotion(emotion);
  };

  const handleSaveParams = () => {
    const words = tempWordList.split('\n').map(w => w.trim()).filter(w => w.length > 0);
    setParams({ ...params, wordList: words });
    toast({ title: 'Parameters saved' });
  };

  const handleBackupTextSubmit = () => {
    if (!backupTextInput.trim() || !gameState.isGameActive) return;
    processingQueueRef.current.push(backupTextInput.trim());
    setBackupTextInput('');
    processNextInQueue();
    toast({ title: 'Text submitted', description: `Processing: "${backupTextInput.trim()}"` });
  };

  return (
    <div className="min-h-screen bg-background p-6 snowfall">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-christmas-gold">🎄 Christmas Riddle Game</h1>
            <p className="text-muted-foreground">Admin Control Panel</p>
          </div>
          <Button 
            onClick={handleOpenDisplay}
            className="bg-christmas-green hover:bg-christmas-green/80"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Open User Display
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Controls */}
          <div className="lg:col-span-2 space-y-6">
            {/* Game Controls */}
            <Card className="christmas-card">
              <CardHeader>
                <CardTitle className="text-christmas-gold flex items-center gap-2">
                  <Play className="h-5 w-5" />
                  Game Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={handleStartGame}
                    disabled={gameState.isGameActive || isLMLoading}
                    className="bg-christmas-green hover:bg-christmas-green/80"
                    size="lg"
                  >
                    <Play className="mr-2 h-5 w-5" />
                    Start Game
                  </Button>

                  <Button
                    onClick={handleStopGame}
                    disabled={!gameState.isGameActive}
                    variant="destructive"
                    size="lg"
                  >
                    <Square className="mr-2 h-5 w-5" />
                    Stop Game
                  </Button>

                  <Button
                    onClick={handleMuteToggle}
                    variant={isMuted ? 'destructive' : 'secondary'}
                    size="lg"
                  >
                    {isMuted ? (
                      <>
                        <MicOff className="mr-2 h-5 w-5" />
                        Unmute
                      </>
                    ) : (
                      <>
                        <Mic className="mr-2 h-5 w-5" />
                        Mute
                      </>
                    )}
                  </Button>

                  {/* Audio Device Selector */}
                  <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                    <SelectTrigger className="w-[180px] h-11 bg-background border-border">
                      <Mic className="mr-2 h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder="Select microphone" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border z-50">
                      {audioDevices.map((device) => (
                        <SelectItem key={device.deviceId} value={device.deviceId}>
                          {device.label || `Microphone ${audioDevices.indexOf(device) + 1}`}
                        </SelectItem>
                      ))}
                      {audioDevices.length === 0 && (
                        <SelectItem value="none" disabled>
                          No microphones found
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>

                  {/* Piper TTS Status */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-background border border-border rounded-lg h-11">
                    <Volume2 className="h-4 w-4 text-muted-foreground" />
                    {isTTSLoading ? (
                      <span className="text-sm text-muted-foreground">Downloading voice... {downloadProgress}%</span>
                    ) : isPiperReady && !useFallback ? (
                      <span className="text-sm text-christmas-green">Piper (Norman)</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Browser Voice</span>
                    )}
                  </div>

                  <Button
                    onClick={handleGiveHint}
                    disabled={!gameState.isGameActive || gameState.hintsRemaining <= 0}
                    className="bg-christmas-gold text-background hover:bg-christmas-gold/80"
                    size="lg"
                  >
                    <Lightbulb className="mr-2 h-5 w-5" />
                    Give Hint ({gameState.hintsRemaining})
                  </Button>
                </div>

                {/* Status Indicators */}
                <div className="flex flex-wrap gap-2">
                  <Badge variant={gameState.isGameActive ? 'default' : 'secondary'}>
                    {gameState.isGameActive ? '🎮 Game Active' : '⏸️ Not Playing'}
                  </Badge>
                  <Badge variant={isListening ? 'default' : 'outline'}>
                    {isListening ? '🎤 Listening' : '🔇 Not Listening'}
                  </Badge>
                  <Badge variant={isSpeaking ? 'default' : 'outline'}>
                    {isSpeaking ? '🔊 Speaking' : '🔈 Silent'}
                  </Badge>
                  <Badge variant={isProcessing ? 'default' : 'outline'}>
                    {isProcessing ? '⚙️ Processing' : '✓ Ready'}
                  </Badge>
                </div>

                {!speechSupported && (
                  <div className="p-3 bg-destructive/20 rounded-lg text-destructive">
                    ⚠️ Microphone access not available. Please allow microphone permissions.
                  </div>
                )}

                {/* Text Input for Questions & Guesses */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <Label className="text-muted-foreground">Ask Questions or Make Guesses</Label>
                  <div className="flex gap-2">
                    <Input
                      value={backupTextInput}
                      onChange={(e) => setBackupTextInput(e.target.value)}
                      placeholder="Ask a question or guess the answer..."
                      disabled={!gameState.isGameActive}
                      onKeyDown={(e) => e.key === 'Enter' && handleBackupTextSubmit()}
                    />
                    <Button
                      onClick={handleBackupTextSubmit}
                      disabled={!gameState.isGameActive || !backupTextInput.trim()}
                      size="icon"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Examples: "Is it something you eat?" or "candy cane"
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Current Game Info */}
            {gameState.isGameActive && (
              <Card className="christmas-card border-christmas-gold">
                <CardHeader>
                  <CardTitle className="text-christmas-gold">🎯 Current Game</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Secret Word</Label>
                      <p className="text-2xl font-bold text-christmas-red uppercase">
                        {gameState.currentWord}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Hints Remaining</Label>
                      <p className="text-2xl font-bold text-christmas-gold">
                        {gameState.hintsRemaining} / {params.hintsAllowed}
                      </p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Current Riddle</Label>
                    <p className="text-lg italic text-foreground bg-muted/30 p-3 rounded-lg">
                      "{gameState.currentRiddle}"
                    </p>
                  </div>
                <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <p className="text-lg text-foreground">{gameState.statusText}</p>
                  </div>
                  {lastAIResponse && (
                    <div>
                      <Label className="text-muted-foreground">Last AI Response</Label>
                      <p className="text-lg text-foreground bg-christmas-green/20 p-3 rounded-lg border border-christmas-green/30">
                        "{lastAIResponse}"
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Tabs for Params and Display */}
            <Tabs defaultValue="display" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="display">
                  <Monitor className="mr-2 h-4 w-4" />
                  Set Display
                </TabsTrigger>
                <TabsTrigger value="params">
                  <Settings className="mr-2 h-4 w-4" />
                  Parameters
                </TabsTrigger>
              </TabsList>

              <TabsContent value="display">
                <Card className="christmas-card">
                  <CardContent className="pt-6 space-y-4">
                    <div className="space-y-2">
                      <Label>Display Type</Label>
                      <Select value={customDisplayType} onValueChange={(v: 'text' | 'image' | 'video') => setCustomDisplayType(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text Message</SelectItem>
                          <SelectItem value="image">Image URL</SelectItem>
                          <SelectItem value="video">Video URL</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>
                        {customDisplayType === 'text' ? 'Message' : 
                         customDisplayType === 'image' ? 'Image URL' : 'Video URL'}
                      </Label>
                      <Textarea
                        value={customDisplayContent}
                        onChange={(e) => setCustomDisplayContent(e.target.value)}
                        placeholder={
                          customDisplayType === 'text' ? 'Enter a message to display...' :
                          customDisplayType === 'image' ? 'https://example.com/image.jpg' :
                          'https://example.com/video.mp4'
                        }
                      />
                    </div>
                    <Button onClick={handleSetDisplay} className="w-full">
                      Update Display
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="params">
                <Card className="christmas-card">
                  <CardContent className="pt-6 space-y-4">
                    <div className="space-y-2">
                      <Label>Difficulty: {params.difficulty}</Label>
                      <Select 
                        value={params.difficulty} 
                        onValueChange={(v: 'easy' | 'medium' | 'hard') => setParams({ ...params, difficulty: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="easy">Easy</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="hard">Hard</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Hints Allowed: {params.hintsAllowed}</Label>
                      <Slider
                        value={[params.hintsAllowed]}
                        onValueChange={([v]) => setParams({ ...params, hintsAllowed: v })}
                        min={0}
                        max={10}
                        step={1}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Word List (one per line)</Label>
                      <Textarea
                        value={tempWordList}
                        onChange={(e) => setTempWordList(e.target.value)}
                        className="min-h-[200px] font-mono"
                      />
                    </div>
                    <Button onClick={handleSaveParams} className="w-full">
                      Save Parameters
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Sidebar - Character Preview & Manual Controls */}
          <div className="space-y-6">
            {/* Character Preview */}
            <Card className="christmas-card">
              <CardHeader>
                <CardTitle className="text-christmas-gold">Character Preview</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center">
                <ChristmasCharacter emotion={gameState.emotion} size="md" />
              </CardContent>
            </Card>

            {/* Manual Emotion Controls */}
            <Card className="christmas-card">
              <CardHeader>
                <CardTitle className="text-christmas-gold">Manual Emotion Override</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleManualEmotion('neutral')}
                  className="flex flex-col items-center py-4"
                >
                  <Meh className="h-6 w-6 text-emotion-neutral" />
                  <span className="text-xs mt-1">Neutral</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleManualEmotion('listening')}
                  className="flex flex-col items-center py-4"
                >
                  <Headphones className="h-6 w-6 text-emotion-listening" />
                  <span className="text-xs mt-1">Listening</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleManualEmotion('thinking')}
                  className="flex flex-col items-center py-4"
                >
                  <HelpCircle className="h-6 w-6 text-emotion-thinking" />
                  <span className="text-xs mt-1">Thinking</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleManualEmotion('happy')}
                  className="flex flex-col items-center py-4"
                >
                  <Smile className="h-6 w-6 text-emotion-happy" />
                  <span className="text-xs mt-1">Happy</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleManualEmotion('sad')}
                  className="flex flex-col items-center py-4"
                >
                  <Frown className="h-6 w-6 text-emotion-sad" />
                  <span className="text-xs mt-1">Sad</span>
                </Button>
              </CardContent>
            </Card>

            {/* Connection Status */}
            <Card className="christmas-card">
              <CardHeader>
                <CardTitle className="text-christmas-gold text-sm">System Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Speech Recognition</span>
                  <Badge variant={speechSupported ? 'default' : 'destructive'}>
                    {speechSupported ? '✓ Ready' : '✗ Not Supported'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Display Window</span>
                  <Badge variant={displayWindow && !displayWindow.closed ? 'default' : 'secondary'}>
                    {displayWindow && !displayWindow.closed ? '✓ Open' : '○ Closed'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">LM Studio</span>
                  <Badge variant={isLMLoading ? 'outline' : 'default'}>
                    {isLMLoading ? '⏳ Processing' : '✓ Ready'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
