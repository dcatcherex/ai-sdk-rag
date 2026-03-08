'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';

export type VoiceState = 'idle' | 'connecting' | 'listening' | 'ai-speaking' | 'error';

export type VoiceTurn = {
  role: 'user' | 'ai';
  text: string;
  partial?: boolean;
};

export type VoiceHistoryTurn = {
  role: 'user' | 'assistant';
  text: string;
};

type UseLiveVoiceOptions = {
  enabled: boolean;
  onError?: (message: string) => void;
  onTurnComplete?: (userText: string, aiText: string) => void;
  history?: VoiceHistoryTurn[];
};

export function useLiveVoice({ enabled, onError, onTurnComplete, history }: UseLiveVoiceOptions) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState<VoiceTurn[]>([]);
  const [micLevel, setMicLevel] = useState(0);

  // Internal refs — not state so they don't cause re-renders
  const sessionRef = useRef<ReturnType<InstanceType<typeof GoogleGenAI>['live']['connect']> extends Promise<infer T> ? T : never | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const playbackQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const muteRef = useRef(false);
  const speakAloudRef = useRef(true);
  const [speakAloud, setSpeakAloudState] = useState(true);

  // Accumulate partial transcripts during a turn
  const inputTranscriptAccRef = useRef('');
  const outputTranscriptAccRef = useRef('');

  const reportError = useCallback((msg: string) => {
    setVoiceState('error');
    onError?.(msg);
  }, [onError]);

  // ── Audio Playback ─────────────────────────────────────────────────────────

  const playNextChunk = useCallback(() => {
    if (!speakAloudRef.current) {
      playbackQueueRef.current = [];
      isPlayingRef.current = false;
      return;
    }
    if (playbackQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }
    if (!playbackContextRef.current || playbackContextRef.current.state === 'closed') {
      playbackContextRef.current = new AudioContext({ sampleRate: 24000 });
    }
    const ctx = playbackContextRef.current;
    const buffer = playbackQueueRef.current.shift()!;
    const int16 = new Int16Array(buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }
    const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
    audioBuffer.copyToChannel(float32, 0);
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.onended = playNextChunk;
    source.start();
  }, []);

  const enqueueAudio = useCallback((base64: string) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    playbackQueueRef.current.push(bytes.buffer);
    if (!isPlayingRef.current) {
      isPlayingRef.current = true;
      playNextChunk();
    }
  }, [playNextChunk]);

  const clearPlaybackQueue = useCallback(() => {
    playbackQueueRef.current = [];
    isPlayingRef.current = false;
    // Close and recreate context to stop any currently-playing buffer immediately
    if (playbackContextRef.current && playbackContextRef.current.state !== 'closed') {
      void playbackContextRef.current.close();
      playbackContextRef.current = null;
    }
  }, []);

  // ── Session message handler ────────────────────────────────────────────────

  const onTurnCompleteRef = useRef(onTurnComplete);
  onTurnCompleteRef.current = onTurnComplete;

  const historyRef = useRef(history);
  historyRef.current = history;

  const handleMessage = useCallback((message: Record<string, unknown>) => {
    const serverContent = message.serverContent as Record<string, unknown> | undefined;
    if (!serverContent) return;

    // Interruption: user spoke while AI was responding — drop partial AI turn
    if (serverContent.interrupted) {
      clearPlaybackQueue();
      outputTranscriptAccRef.current = '';
      setTranscript((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'ai' && last.partial) return prev.slice(0, -1);
        return prev;
      });
      setVoiceState('listening');
      return;
    }

    // Audio response chunks
    const modelTurn = serverContent.modelTurn as Record<string, unknown> | undefined;
    if (modelTurn) {
      setVoiceState('ai-speaking');
      const parts = modelTurn.parts as Array<Record<string, unknown>> | undefined;
      if (parts) {
        for (const part of parts) {
          const inlineData = part.inlineData as Record<string, unknown> | undefined;
          if (inlineData?.data && typeof inlineData.data === 'string') {
            enqueueAudio(inlineData.data);
          }
        }
      }
    }

    // Input transcription (what user said) — stream chunks live
    const inputTranscription = serverContent.inputTranscription as Record<string, unknown> | undefined;
    if (inputTranscription?.text && typeof inputTranscription.text === 'string') {
      inputTranscriptAccRef.current += inputTranscription.text;
      const text = inputTranscriptAccRef.current;
      setTranscript((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'user' && last.partial) {
          return [...prev.slice(0, -1), { role: 'user', text, partial: true }];
        }
        return [...prev, { role: 'user', text, partial: true }];
      });
    }

    // Output transcription (what AI said) — stream chunks live
    const outputTranscription = serverContent.outputTranscription as Record<string, unknown> | undefined;
    if (outputTranscription?.text && typeof outputTranscription.text === 'string') {
      outputTranscriptAccRef.current += outputTranscription.text;
      const text = outputTranscriptAccRef.current;
      setTranscript((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'ai' && last.partial) {
          return [...prev.slice(0, -1), { role: 'ai', text, partial: true }];
        }
        return [...prev, { role: 'ai', text, partial: true }];
      });
    }

    // Turn complete — finalize (remove partial flags) and persist
    if (serverContent.turnComplete) {
      const userText = inputTranscriptAccRef.current.trim();
      const aiText = outputTranscriptAccRef.current.trim();
      inputTranscriptAccRef.current = '';
      outputTranscriptAccRef.current = '';

      setTranscript((prev) => prev.map((turn) => turn.partial ? { ...turn, partial: false } : turn));
      if (userText || aiText) {
        onTurnCompleteRef.current?.(userText, aiText);
      }
      setVoiceState('listening');
    }
  }, [clearPlaybackQueue, enqueueAudio]);

  // ── Microphone setup ───────────────────────────────────────────────────────

  const startMicrophone = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    streamRef.current = stream;

    const ctx = new AudioContext();
    audioContextRef.current = ctx;

    await ctx.audioWorklet.addModule('/worklets/pcm-processor.js');

    const source = ctx.createMediaStreamSource(stream);
    const workletNode = new AudioWorkletNode(ctx, 'pcm-processor');
    workletNodeRef.current = workletNode;

    // Mic level for waveform animation
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    source.connect(workletNode);
    workletNode.connect(ctx.destination); // needed to keep worklet active

    const levelData = new Uint8Array(analyser.frequencyBinCount);
    const measureLevel = () => {
      if (!streamRef.current) return;
      analyser.getByteFrequencyData(levelData);
      const avg = levelData.reduce((a, b) => a + b, 0) / levelData.length;
      setMicLevel(avg / 128); // 0-1 range
      requestAnimationFrame(measureLevel);
    };
    requestAnimationFrame(measureLevel);

    // Forward PCM chunks to Gemini session
    workletNode.port.onmessage = (event: MessageEvent<{ pcm: Int16Array }>) => {
      if (!sessionRef.current || muteRef.current) return;
      const int16 = event.data.pcm;
      const bytes = new Uint8Array(int16.buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      void (sessionRef.current as unknown as { sendRealtimeInput: (args: unknown) => void }).sendRealtimeInput({
        audio: { data: base64, mimeType: 'audio/pcm;rate=16000' },
      });
    };
  }, []);

  const stopMicrophone = useCallback(() => {
    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    setMicLevel(0);
  }, []);

  // ── Connect / Disconnect ───────────────────────────────────────────────────

  const connect = useCallback(async () => {
    if (voiceState !== 'idle' && voiceState !== 'error') return;
    setVoiceState('connecting');
    setTranscript([]);

    try {
      // Get ephemeral token from our backend
      const res = await fetch('/api/live-token');
      if (!res.ok) throw new Error('Failed to get live token');
      const { token } = await res.json() as { token: string };

      // Connect directly to Gemini Live API using ephemeral token
      const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: 'v1alpha' } });

      const session = await ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: 'You are a helpful, friendly assistant. Always respond in the same language the user speaks in — Thai or English. Keep responses conversational and concise.',
          contextWindowCompression: { slidingWindow: {} },
        },
        callbacks: {
          onopen: () => {
            setVoiceState('listening');
          },
          onmessage: (message: unknown) => {
            handleMessage(message as Record<string, unknown>);
          },
          onerror: (e: { message?: string }) => {
            reportError(e.message ?? 'Connection error');
          },
          onclose: () => {
            if (voiceState !== 'idle') setVoiceState('idle');
          },
        },
      });

      sessionRef.current = session as typeof sessionRef.current;

      // Inject prior thread turns directly into conversation history.
      // sendClientContent appends turns to the model's context window — unlike
      // systemInstruction, the model treats these as actual conversation turns it participated in.
      const priorTurns = (historyRef.current ?? []).slice(-30).filter((t) => t.text.trim());
      if (priorTurns.length > 0) {
        const turns = priorTurns.map((t) => ({
          role: t.role === 'assistant' ? ('model' as const) : ('user' as const),
          parts: [{ text: t.text }],
        }));
        try {
          (session as unknown as {
            sendClientContent: (p: { turns: typeof turns; turnComplete: boolean }) => void;
          }).sendClientContent({ turns, turnComplete: false });
          console.log('[useLiveVoice] sendClientContent — injected', turns.length, 'history turns');
        } catch (e) {
          console.warn('[useLiveVoice] sendClientContent failed:', e);
        }
      } else {
        console.log('[useLiveVoice] sendClientContent — no history to inject');
      }

      // Start microphone after session is established
      await startMicrophone();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      reportError(msg);
    }
  }, [voiceState, handleMessage, startMicrophone, reportError]);

  const disconnect = useCallback(() => {
    stopMicrophone();
    clearPlaybackQueue();
    if (sessionRef.current) {
      try {
        (sessionRef.current as unknown as { close: () => void }).close();
      } catch {
        // ignore close errors
      }
      sessionRef.current = null;
    }
    setVoiceState('idle');
    setMicLevel(0);
  }, [stopMicrophone, clearPlaybackQueue]);

  const toggleSpeakAloud = useCallback(() => {
    speakAloudRef.current = !speakAloudRef.current;
    setSpeakAloudState(speakAloudRef.current);
    if (!speakAloudRef.current) clearPlaybackQueue();
  }, [clearPlaybackQueue]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-disconnect when disabled (e.g. component unmounts)
  useEffect(() => {
    if (!enabled && voiceState !== 'idle') {
      disconnect();
    }
  }, [enabled, voiceState, disconnect]);

  return {
    voiceState,
    transcript,
    micLevel,
    speakAloud,
    connect,
    disconnect,
    toggleSpeakAloud,
  };
}
