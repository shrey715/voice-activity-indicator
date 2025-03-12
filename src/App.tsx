import { useState, useEffect, useRef } from 'react';
import { Play, Mic, X, Volume2, Loader2, Music } from 'lucide-react';

const App = () => {
  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioSource, setAudioSource] = useState(null);
  const [frequencyData, setFrequencyData] = useState([]);
  const [selectedTrack, setSelectedTrack] = useState('gardens');
  const [isLoading, setIsLoading] = useState(false);
  
  const micStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const audioElementRef = useRef(null);
  const frameRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const prevLevelRef = useRef(0);
  
  // Audio tracks
  const audioTracks = {
    gardens: {
      name: "Gardens",
      path: "/public/audio/gardens.mp3",
      color: "bg-emerald-500",
      hoverColor: "hover:bg-emerald-600",
      activeColor: "bg-emerald-600"
    },
    kugelsicher: {
      name: "Kugelsicher",
      path: "/public/audio/kugelsicher.mp3",
      color: "bg-violet-500",
      hoverColor: "hover:bg-violet-600",
      activeColor: "bg-violet-600"
    },
    spinningHead: {
      name: "Spinning Head",
      path: "/public/audio/spinning-head.mp3",
      color: "bg-amber-500",
      hoverColor: "hover:bg-amber-600",
      activeColor: "bg-amber-600"
    }
  };
  
  const sampleAudioUrl = audioTracks[selectedTrack].path;

  // Initialize audio context
  useEffect(() => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioContextRef.current = new AudioContext();
    analyserRef.current = audioContextRef.current.createAnalyser();
    analyserRef.current.fftSize = 256;
    analyserRef.current.smoothingTimeConstant = 0.7;
    
    return () => {
      cancelAnimationFrame(frameRef.current);
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Function to start microphone listening
  const startMicrophone = async () => {
    try {
      if (isPlaying) {
        stopAudio();
      }
      
      // Resume audio context if suspended
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStreamRef.current = stream;
      
      // Connect microphone to audio analyzer
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
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
    setFrequencyData([]);
    
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
    if (audioContextRef.current.state === 'suspended') {
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
    sourceNodeRef.current = audioContextRef.current.createMediaElementSource(audioElementRef.current);
    sourceNodeRef.current.connect(analyserRef.current);
    analyserRef.current.connect(audioContextRef.current.destination);
    
    // Play the audio
    try {
      await audioElementRef.current.play();
      setIsPlaying(true);
      setAudioSource('playback');
      
      // Start analyzing audio
      analyzeAudio();
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
    setFrequencyData([]);
    
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
  const selectTrack = (trackId) => {
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
    const baseColor = audioTracks[selectedTrack].color.replace('bg-', '');
    
    // Return the appropriate color class based on level and track
    if (audioLevel < 0.3) return `bg-${baseColor}`;
    if (audioLevel < 0.6) return `bg-${baseColor}`;
    if (audioLevel < 0.8) return `bg-${baseColor}`;
    return `bg-${baseColor}`;
  };

  // Pulse animation for very low levels to show it's active
  const getPulseClass = () => {
    if (audioSource && audioLevel < 0.1) return 'animate-pulse';
    return '';
  };

  // Calculate glow intensity based on audio level
  const getGlowIntensity = () => {
    // Scale from 0.2 to 1 based on audio level
    return 0.2 + (audioLevel * 0.8);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 w-full max-w-md flex flex-col items-center border border-slate-200 dark:border-slate-700">
        <div className="w-full flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Music size={24} className="text-emerald-500" />
            Creek
          </h1>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full">
            Audio Visualizer
          </span>
        </div>
        
        {/* Track Selection */}
        <div className="w-full grid grid-cols-3 gap-2 mb-6">
          {Object.entries(audioTracks).map(([id, track]) => (
            <button
              key={id}
              onClick={() => selectTrack(id)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedTrack === id 
                  ? `${track.color} text-white` 
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {track.name}
            </button>
          ))}
        </div>
        
        {/* Indicator Circle - Simplified without frequency bars */}
        <div className="relative mb-8 h-72 w-72 flex items-center justify-center">
          {/* Outer reference circle */}
          <div className="absolute w-48 h-48 rounded-full border border-slate-200 dark:border-slate-700" />
          
          {/* Active indicator */}
          <div 
            className={`rounded-full ${getIndicatorColor()} ${getPulseClass()} transition-all duration-100 ease-out shadow-lg flex items-center justify-center`}
            style={{ 
              width: `${currentSize}px`, 
              height: `${currentSize}px`, 
              opacity: audioSource ? 0.85 : 0.5,
              boxShadow: audioSource ? `0 0 ${30 + (audioLevel * 20)}px ${getBoxShadowColor(selectedTrack, getGlowIntensity())}` : 'none'
            }}
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
          </div>
        </div>
        
        {/* Audio level indicator */}
        <div className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-full mb-8 overflow-hidden">
          <div 
            className={`h-full transition-all duration-100 ${audioTracks[selectedTrack].color}`}
            style={{ width: `${Math.max(2, audioLevel * 100)}%` }}
          ></div>
        </div>
        
        {/* Control Buttons */}
        <div className="flex w-full gap-3 mb-4">
          <button 
            onClick={handleMicToggle}
            className={`flex-1 flex items-center justify-center px-4 py-3 rounded-md font-medium text-white transition-colors ${
              isListening 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-slate-700 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700'
            }`}
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
          </button>
          
          <button 
            onClick={handlePlayToggle}
            className={`flex-1 flex items-center justify-center px-4 py-3 rounded-md font-medium text-white transition-colors ${
              isPlaying 
                ? 'bg-red-500 hover:bg-red-600' 
                : `${audioTracks[selectedTrack].color} ${audioTracks[selectedTrack].hoverColor}`
            }`}
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
          </button>
        </div>
        
        {/* Status indicator */}
        <div className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-md flex items-center justify-between text-sm">
          <div className="flex items-center">
            {audioSource ? (
              <>
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
                <span className="text-slate-700 dark:text-slate-200">
                  {audioSource === 'microphone' ? 'Microphone active' : `Playing ${audioTracks[selectedTrack].name}`}
                </span>
              </>
            ) : (
              <>
                <span className="inline-block w-2 h-2 rounded-full bg-slate-400 mr-2"></span>
                <span className="text-slate-500 dark:text-slate-400">Waiting for input</span>
              </>
            )}
          </div>
          
          {audioSource && (
            <span className="font-mono text-xs px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded-md">
              {Math.round(audioLevel * 100)}%
            </span>
          )}
        </div>
      </div>
      
      <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">
        Creek © 2025
      </div>
    </div>
  );
};

// Update the box shadow color function to include opacity
const getBoxShadowColor = (trackId, opacity = 0.4) => {
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

export default App;
