"use client";

import { useState, useEffect, useRef } from 'react';
import { Play, Mic, X, Volume2, Loader2, Music } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/toggle';

// Define track ID type to ensure type safety
type TrackId = 'gardens' | 'kugelsicher' | 'spinningHead';
type AudioSourceType = 'microphone' | 'playback' | null;

export default function AudioVisualizer() {
  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioSource, setAudioSource] = useState<AudioSourceType>(null);
  const [selectedTrack, setSelectedTrack] = useState<TrackId>('gardens');
  const [isLoading, setIsLoading] = useState(false);
  
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const prevLevelRef = useRef<number>(0);
  
  // Audio tracks with proper typing
  const audioTracks = {
    gardens: {
      name: "Gardens",
      path: "/audio/gardens.mp3",
      color: "bg-emerald-500",
      hoverColor: "hover:bg-emerald-600",
      activeColor: "bg-emerald-600"
    },
    kugelsicher: {
      name: "Kugelsicher",
      path: "/audio/kugelsicher.mp3",
      color: "bg-violet-500",
      hoverColor: "hover:bg-violet-600",
      activeColor: "bg-violet-600"
    },
    spinningHead: {
      name: "Spinning Head",
      path: "/audio/spinning-head.mp3",
      color: "bg-amber-500",
      hoverColor: "hover:bg-amber-600",
      activeColor: "bg-amber-600"
    }
  };
  
  const sampleAudioUrl = audioTracks[selectedTrack].path;

  // Initialize audio context
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Fix the AudioContext declaration
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.7;
      
      return () => {
        if (frameRef.current) {
          cancelAnimationFrame(frameRef.current);
        }
        if (micStreamRef.current) {
          micStreamRef.current.getTracks().forEach(track => track.stop());
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
        }
      };
    }
  }, []);

  // Function to start microphone listening
  const startMicrophone = async () => {
    try {
      if (isPlaying) {
        stopAudio();
      }
      
      // Resume audio context if suspended
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStreamRef.current = stream;
      
      // Connect microphone to audio analyzer
      if (audioContextRef.current && analyserRef.current) {
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);
      }
      
      setIsListening(true);
      setAudioSource('microphone');
      
      // Start analyzing audio
      analyzeAudio();
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  // Function to stop microphone listening
  const stopMicrophone = () => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    
    setIsListening(false);
    setAudioSource(null);
    setAudioLevel(0);
    
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  };

  // Function to play audio file
  const playAudio = async () => {
    if (isListening) {
      stopMicrophone();
    }
    
    setIsLoading(true);
    
    // Resume audio context if it's suspended (needed for browser autoplay policies)
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    
    if (audioElementRef.current) {
      audioElementRef.current.removeEventListener('ended', stopAudio);
      audioElementRef.current = null;
      if (sourceNodeRef.current) {
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
      }
    }
    
    audioElementRef.current = new Audio(sampleAudioUrl);
    audioElementRef.current.addEventListener('ended', stopAudio);
    audioElementRef.current.addEventListener('loadeddata', () => {
      setIsLoading(false);
    });
    
    // Create a source node for the audio element
    if (audioContextRef.current && analyserRef.current && audioElementRef.current) {
      sourceNodeRef.current = audioContextRef.current.createMediaElementSource(audioElementRef.current);
      sourceNodeRef.current.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);
    }
    
    // Play the audio
    try {
      if (audioElementRef.current) {
        await audioElementRef.current.play();
        setIsPlaying(true);
        setAudioSource('playback');
        
        // Start analyzing audio
        analyzeAudio();
      }
    } catch (error) {
      console.error("Error playing audio:", error);
      setIsLoading(false);
      alert("Could not play audio. Please try clicking the play button again.");
    }
  };

  // Function to stop audio playback
  const stopAudio = () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }
    
    setIsPlaying(false);
    setAudioSource(null);
    setAudioLevel(0);
    
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  };

  // Function to analyze audio and update the indicator
  const analyzeAudio = () => {
    if (!analyserRef.current) return;
    
    const frequencyBinCount = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(frequencyBinCount);
    
    const updateLevel = () => {
      if (!analyserRef.current) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Calculate average volume level with emphasis on speech frequencies
      let sum = 0;
      let count = 0;
      
      for (let i = 0; i < frequencyBinCount; i++) {
        // Calculate weighted average with emphasis on mid-range frequencies
        // which are more relevant for speech
        const weight = i < frequencyBinCount / 2 ? 1.5 : 0.8;
        sum += dataArray[i] * weight;
        count++;
      }
      
      const average = sum / count;
      
      // Smooth transitions with interpolation
      const targetLevel = Math.min(Math.pow(average / 128, 1.8), 1);
      const smoothingFactor = 0.15; // Lower for smoother transitions
      const interpolatedLevel = prevLevelRef.current + 
        (targetLevel - prevLevelRef.current) * smoothingFactor;
      
      prevLevelRef.current = interpolatedLevel;
      setAudioLevel(interpolatedLevel);
      
      frameRef.current = requestAnimationFrame(updateLevel);
    };
    
    updateLevel();
  };

  // Function to select a track
  const selectTrack = (trackId: TrackId) => {
    if (isPlaying) {
      stopAudio();
    }
    setSelectedTrack(trackId);
  };

  // Handle toggling microphone
  const handleMicToggle = () => {
    if (isListening) {
      stopMicrophone();
    } else {
      startMicrophone();
    }
  };

  // Handle toggling audio playback
  const handlePlayToggle = () => {
    if (isPlaying) {
      stopAudio();
    } else {
      playAudio();
    }
  };

  // Calculate indicator size based on audio level
  const baseSize = 120; // Base size in pixels
  const maxExpansion = 80; // Maximum expansion in pixels
  const currentSize = baseSize + (audioLevel * maxExpansion);

  // Color transition based on audio level and selected track
  const getIndicatorColor = () => {
    const baseColor = audioTracks[selectedTrack].color;
    return baseColor;
  };

  // Get box shadow color based on track and intensity
  const getBoxShadowColor = (trackId: TrackId, opacity = 0.4) => {
    const opacityValue = opacity.toFixed(2);
    switch (trackId) {
      case 'gardens':
        return `rgba(16, 185, 129, ${opacityValue})`;  // emerald shadow
      case 'kugelsicher':
        return `rgba(139, 92, 246, ${opacityValue})`;  // violet shadow
      case 'spinningHead':
        return `rgba(245, 158, 11, ${opacityValue})`;  // amber shadow
      default:
        return `rgba(129, 140, 248, ${opacityValue})`; // default indigo shadow
    }
  };

  // Calculate glow intensity based on audio level
  const getGlowIntensity = () => {
    // Scale from 0.2 to 1 based on audio level
    return 0.2 + (audioLevel * 0.8);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Music size={24} className="text-emerald-500" />
            Creek
          </CardTitle>
          <div className="flex items-center gap-3">
            <Badge variant="outline">Audio Visualizer</Badge>
            <ThemeToggle />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-6">
          {/* Track Selection */}
          <div className="w-full grid grid-cols-3 gap-2">
            {(Object.entries(audioTracks) as [TrackId, typeof audioTracks[TrackId]][]).map(([id, track]) => (
              <Button
                key={id}
                onClick={() => selectTrack(id)}
                variant={selectedTrack === id ? "default" : "outline"}
                className={selectedTrack === id ? track.color : ""}
              >
                {track.name}
              </Button>
            ))}
          </div>
          
          {/* Indicator Circle */}
          <div className="relative h-72 w-72 flex items-center justify-center">
            {/* Outer reference circle */}
            <div className="absolute w-48 h-48 rounded-full border border-muted" />
            
            {/* Active indicator with motion */}
            <motion.div 
              className={`rounded-full ${getIndicatorColor()} flex items-center justify-center`}
              animate={{ 
                width: `${currentSize}px`,
                height: `${currentSize}px`,
                opacity: audioSource ? 0.85 : 0.5,
                boxShadow: audioSource ? `0 0 ${30 + (audioLevel * 20)}px ${getBoxShadowColor(selectedTrack, getGlowIntensity())}` : 'none'
              }}
              transition={{ duration: 0.1 }}
            >
              {isLoading ? (
                <Loader2 size={28} className="text-white animate-spin" />
              ) : audioSource ? (
                <div className="text-white">
                  {audioSource === 'microphone' ? (
                    <Mic size={28} />
                  ) : (
                    <Volume2 size={28} />
                  )}
                </div>
              ) : null}
            </motion.div>
          </div>
          
          {/* Audio level indicator */}
          <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
            <motion.div 
              className={getIndicatorColor()}
              animate={{ 
                width: `${Math.max(2, audioLevel * 100)}%` 
              }}
              transition={{ duration: 0.1 }}
            />
          </div>
          
          {/* Control Buttons */}
          <div className="flex w-full gap-3">
            <Button 
              onClick={handleMicToggle}
              variant={isListening ? "destructive" : "outline"}
              className="flex-1"
            >
              {isListening ? (
                <>
                  <X className="mr-2" size={18} />
                  Stop Mic
                </>
              ) : (
                <>
                  <Mic className="mr-2" size={18} />
                  Start Mic
                </>
              )}
            </Button>
            
            <Button 
              onClick={handlePlayToggle}
              variant={isPlaying ? "destructive" : "default"}
              className={isPlaying ? "" : getIndicatorColor()}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 animate-spin" size={18} />
                  Loading...
                </>
              ) : isPlaying ? (
                <>
                  <X className="mr-2" size={18} />
                  Stop Audio
                </>
              ) : (
                <>
                  <Play className="mr-2" size={18} />
                  Play {audioTracks[selectedTrack].name}
                </>
              )}
            </Button>
          </div>
          
          {/* Status indicator */}
          <div className="w-full p-3 bg-muted/50 rounded-md flex items-center justify-between text-sm">
            <div className="flex items-center">
              {audioSource ? (
                <>
                  <motion.span 
                    className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-2"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <span>
                    {audioSource === 'microphone' ? 'Microphone active' : `Playing ${audioTracks[selectedTrack].name}`}
                  </span>
                </>
              ) : (
                <>
                  <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground mr-2"></span>
                  <span className="text-muted-foreground">Waiting for input</span>
                </>
              )}
            </div>
            
            {audioSource && (
              <Badge variant="outline" className="font-mono">
                {Math.round(audioLevel * 100)}%
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
      
      <div className="mt-4 text-xs text-muted-foreground">
        Creek © 2025
      </div>
    </div>
  );
}