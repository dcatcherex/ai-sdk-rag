'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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
  voiceName?: string;
  onError?: (message: string) => void;
  onTurnComplete?: (userText: string, aiText: string) => void;
  history?: VoiceHistoryTurn[];
};

type LiveBlob = {
  data: string;
  mimeType: string;
};

type LiveRealtimeInput = {
  activityEnd?: object;
  activityStart?: object;
  audio?: LiveBlob;
  text?: string;
  video?: LiveBlob;
};

type LiveWebSocketSession = {
  conn: WebSocket;
  close: () => void;
  sendRealtimeInput: (input: LiveRealtimeInput) => void;
};

const DEFAULT_VOICE = 'Aoede';
const BASE_SYSTEM_INSTRUCTION = 'You are a helpful, friendly assistant. Always respond in the same language the user speaks in — Thai or English. Keep responses conversational and concise.';
const AUDIO_ACTIVITY_THRESHOLD = 20;
const AUDIO_ACTIVITY_HOLD_MS = 900;
const AUDIO_ACTIVITY_FORCE_START_CHUNKS = 6;

function buildSystemInstruction(history?: VoiceHistoryTurn[]) {
  const priorTurns = (history ?? []).slice(-12).filter((turn) => turn.text.trim());
  if (priorTurns.length === 0) {
    return BASE_SYSTEM_INSTRUCTION;
  }

  const serializedHistory = priorTurns
    .map((turn) => `${turn.role === 'assistant' ? 'Assistant' : 'User'}: ${turn.text.trim()}`)
    .join('\n');

  return `${BASE_SYSTEM_INSTRUCTION}\n\nConversation context from the existing text chat:\n${serializedHistory}`;
}

export function useLiveVoice({ enabled, voiceName, onError, onTurnComplete, history }: UseLiveVoiceOptions) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState<VoiceTurn[]>([]);
  const [micLevel, setMicLevel] = useState(0);
  const [speakAloud, setSpeakAloudState] = useState(true);

  // Internal refs — not state so they don't cause re-renders
  const sessionRef = useRef<LiveWebSocketSession | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const playbackQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const speakAloudRef = useRef(true);
  const inputTranscriptAccRef = useRef('');
  const outputTranscriptAccRef = useRef('');
  const sessionHandleRef = useRef<string | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const goAwayReconnectTimeoutRef = useRef<number | null>(null);
  const activityEndTimeoutRef = useRef<number | null>(null);
  const activeConnectionIdRef = useRef<symbol | null>(null);
  const enabledRef = useRef(enabled);
  const manualDisconnectRef = useRef(false);
  const isConnectingRef = useRef(false);
  const isGoAwayReconnectPendingRef = useRef(false);
  const isActivityActiveRef = useRef(false);
  const lowActivityChunkCountRef = useRef(0);
  const connectRef = useRef<(() => Promise<void>) | null>(null);

  enabledRef.current = enabled;

  const reportError = useCallback((msg: string) => {
    setVoiceState('error');
    onError?.(msg);
  }, [onError]);

  const isSessionSocketOpen = useCallback((session: LiveWebSocketSession | null) => {
    if (!session) {
      return false;
    }

    const conn = session.conn as { readyState?: number };
    return conn.readyState === WebSocket.OPEN;
  }, []);

  const clearActivityEndTimeout = useCallback(() => {
    if (activityEndTimeoutRef.current !== null) {
      window.clearTimeout(activityEndTimeoutRef.current);
      activityEndTimeoutRef.current = null;
    }
  }, []);

  const finishActivity = useCallback((session: LiveWebSocketSession | null) => {
    clearActivityEndTimeout();
    if (!session || !isActivityActiveRef.current || !isSessionSocketOpen(session)) {
      isActivityActiveRef.current = false;
      return;
    }
    try {
      session.sendRealtimeInput({ activityEnd: {} });
    } catch {
      // ignore
    }
    isActivityActiveRef.current = false;
  }, [clearActivityEndTimeout, isSessionSocketOpen]);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current !== null) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (goAwayReconnectTimeoutRef.current !== null) {
      window.clearTimeout(goAwayReconnectTimeoutRef.current);
      goAwayReconnectTimeoutRef.current = null;
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (!enabledRef.current || manualDisconnectRef.current || reconnectTimeoutRef.current !== null) {
      return;
    }
    setVoiceState('connecting');
    reconnectTimeoutRef.current = window.setTimeout(() => {
      reconnectTimeoutRef.current = null;
      void connectRef.current?.();
    }, 750);
  }, []);

  const scheduleGoAwayReconnect = useCallback((timeLeftMs?: number) => {
    if (
      !enabledRef.current ||
      manualDisconnectRef.current ||
      goAwayReconnectTimeoutRef.current !== null ||
      isGoAwayReconnectPendingRef.current
    ) {
      return;
    }

    const delay = Math.max(0, Math.min(Math.max((timeLeftMs ?? 1500) - 500, 0), 5000));
    goAwayReconnectTimeoutRef.current = window.setTimeout(() => {
      goAwayReconnectTimeoutRef.current = null;
      const activeSession = sessionRef.current;
      if (!activeSession || !isSessionSocketOpen(activeSession)) {
        return;
      }
      isGoAwayReconnectPendingRef.current = true;
      finishActivity(activeSession);
      try {
        activeSession.close();
      } catch {
        isGoAwayReconnectPendingRef.current = false;
        scheduleReconnect();
      }
    }, delay);
  }, [finishActivity, isSessionSocketOpen, scheduleReconnect]);

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
    const sessionResumptionUpdate = message.sessionResumptionUpdate as Record<string, unknown> | undefined;
    if (sessionResumptionUpdate?.resumable === true && typeof sessionResumptionUpdate.newHandle === 'string') {
      sessionHandleRef.current = sessionResumptionUpdate.newHandle;
    }

    const goAway = message.goAway as Record<string, unknown> | undefined;
    if (goAway?.timeLeft !== undefined) {
      const timeLeftValue = goAway.timeLeft;
      let timeLeftMs: number | undefined;
      if (typeof timeLeftValue === 'number' && Number.isFinite(timeLeftValue)) {
        timeLeftMs = timeLeftValue;
      } else if (typeof timeLeftValue === 'string') {
        if (timeLeftValue.endsWith('s')) {
          const seconds = Number.parseFloat(timeLeftValue.slice(0, -1));
          if (Number.isFinite(seconds)) {
            timeLeftMs = seconds * 1000;
          }
        } else {
          const parsed = Number.parseFloat(timeLeftValue);
          if (Number.isFinite(parsed)) {
            timeLeftMs = parsed;
          }
        }
      }
      scheduleGoAwayReconnect(timeLeftMs);
    }

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

    // A single event can contain multiple parts simultaneously — process all of them.

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

    const ctx = new AudioContext({ sampleRate: 16000 });
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
      const activeSession = sessionRef.current;
      if (!activeSession || !isSessionSocketOpen(activeSession)) return;
      const int16 = event.data.pcm;
      const averageLevel = int16.length > 0
        ? int16.reduce((sum, value) => sum + Math.abs(value), 0) / int16.length
        : 0;
      const hasSpeech = averageLevel > AUDIO_ACTIVITY_THRESHOLD;

      if (hasSpeech) {
        lowActivityChunkCountRef.current = 0;
      } else if (!isActivityActiveRef.current) {
        lowActivityChunkCountRef.current += 1;
      }

      const shouldForceStart =
        !isActivityActiveRef.current &&
        lowActivityChunkCountRef.current >= AUDIO_ACTIVITY_FORCE_START_CHUNKS;

      if ((hasSpeech || shouldForceStart) && !isActivityActiveRef.current) {
        try {
          activeSession.sendRealtimeInput({ activityStart: {} });
          isActivityActiveRef.current = true;
          lowActivityChunkCountRef.current = 0;

          // If we forced activity start on low-level input, still send activityEnd
          // after a short hold so the model can produce a turn.
          if (!hasSpeech) {
            clearActivityEndTimeout();
            activityEndTimeoutRef.current = window.setTimeout(() => {
              finishActivity(activeSession);
            }, AUDIO_ACTIVITY_HOLD_MS);
          }
        } catch {
          return;
        }
      }

      if (!hasSpeech && !isActivityActiveRef.current) return;

      if (hasSpeech) {
        clearActivityEndTimeout();
        activityEndTimeoutRef.current = window.setTimeout(() => {
          finishActivity(activeSession);
        }, AUDIO_ACTIVITY_HOLD_MS);
      }

      const bytes = new Uint8Array(int16.buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      activeSession.sendRealtimeInput({
        audio: { data: base64, mimeType: 'audio/pcm;rate=16000' },
      });
    };
  }, [clearActivityEndTimeout, finishActivity, isSessionSocketOpen]);

  const stopMicrophone = useCallback(() => {
    clearActivityEndTimeout();
    isActivityActiveRef.current = false;
    lowActivityChunkCountRef.current = 0;
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
  }, [clearActivityEndTimeout]);

  // ── Connect / Disconnect ───────────────────────────────────────────────────

  const connect = useCallback(async () => {
    if (sessionRef.current || isConnectingRef.current) return;
    manualDisconnectRef.current = false;
    clearReconnectTimeout();
    isConnectingRef.current = true;
    setVoiceState('connecting');
    const connectionAttemptId = Symbol('live-session');
    activeConnectionIdRef.current = connectionAttemptId;

    const resumeHandle = sessionHandleRef.current;
    if (!resumeHandle) {
      setTranscript([]);
    }

    try {
      // Get ephemeral token from our backend
      const res = await fetch('/api/live-token');
      if (!res.ok) throw new Error('Failed to get live token');
      const { token, model } = await res.json() as { token: string; model?: string };
      if (!model || model.trim().length === 0) {
        throw new Error('Live token response missing model');
      }

      let connected = false;

      const socketUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(token)}`;

      const session = await new Promise<LiveWebSocketSession>((resolve, reject) => {
        const socket = new WebSocket(socketUrl);
        const liveSession: LiveWebSocketSession = {
          conn: socket,
          close: () => {
            if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
              socket.close();
            }
          },
          sendRealtimeInput: (input: LiveRealtimeInput) => {
            if (socket.readyState !== WebSocket.OPEN) {
              return;
            }
            socket.send(JSON.stringify({ realtimeInput: input }));
          },
          sendClientContent: (input: { turnComplete: boolean }) => {
            if (socket.readyState !== WebSocket.OPEN) {
              return;
            }
            socket.send(JSON.stringify({ clientContent: input }));
          },
        };

        socket.onopen = () => {
          if (activeConnectionIdRef.current !== connectionAttemptId) {
            socket.close();
            return;
          }

          const setup = {
            model: `models/${model}`,
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName ?? DEFAULT_VOICE } },
              },
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            realtimeInputConfig: {
              automaticActivityDetection: {
                disabled: true,
              },
            },
            systemInstruction: {
              parts: [{ text: buildSystemInstruction(historyRef.current) }],
            },
            contextWindowCompression: { slidingWindow: {} },
            sessionResumption: resumeHandle ? { handle: resumeHandle } : {},
          };

          socket.send(JSON.stringify({ setup }));
          connected = true;
          isConnectingRef.current = false;
          isGoAwayReconnectPendingRef.current = false;
          clearReconnectTimeout();
          setVoiceState('listening');
          resolve(liveSession);
        };

        socket.onmessage = async (event: MessageEvent<Blob | string>) => {
          if (activeConnectionIdRef.current !== connectionAttemptId) {
            return;
          }
          try {
            const dataText = event.data instanceof Blob ? await event.data.text() : event.data;
            const message = JSON.parse(dataText) as Record<string, unknown>;
            handleMessage(message);
          } catch (error) {
            console.error('[useLiveVoice] invalid session message:', error, event.data);
          }
        };

        socket.onerror = () => {
          if (activeConnectionIdRef.current !== connectionAttemptId) {
            return;
          }
          if (!connected) {
            reject(new Error('Connection error'));
            return;
          }
          reportError('Connection error');
        };

        socket.onclose = (event: CloseEvent) => {
          if (activeConnectionIdRef.current !== connectionAttemptId) {
            return;
          }
          console.warn('[useLiveVoice] session closed — code:', event.code, '| reason:', event.reason);
          if (!connected) {
            reject(new Error(event.reason || `Live session closed (${event.code})`));
            return;
          }
          isConnectingRef.current = false;
          activeConnectionIdRef.current = null;
          sessionRef.current = null;
          stopMicrophone();
          clearPlaybackQueue();
          const shouldReconnect = !manualDisconnectRef.current && enabledRef.current;
          const wasGoAwayReconnect = isGoAwayReconnectPendingRef.current;
          isGoAwayReconnectPendingRef.current = false;
          if (shouldReconnect && wasGoAwayReconnect) {
            void connectRef.current?.();
            return;
          }
          if (shouldReconnect) {
            const description = event.reason
              ? `Live session closed (${event.code ?? 'unknown'}): ${event.reason}`
              : `Live session closed (${event.code ?? 'unknown'})`;
            reportError(description);
            return;
          }
          setVoiceState((prev) => (prev === 'error' ? 'error' : 'idle'));
        };
      });

      if (activeConnectionIdRef.current !== connectionAttemptId) {
        try { session.close(); } catch { /* ignore */ }
        return;
      }

      // Guard against the session closing before await resolved (race condition)
      if (!connected && !isSessionSocketOpen(session)) {
        isConnectingRef.current = false;
        isGoAwayReconnectPendingRef.current = false;
        if (activeConnectionIdRef.current === connectionAttemptId) {
          activeConnectionIdRef.current = null;
        }
        return;
      }

      sessionRef.current = session;

      // Start microphone after session is established
      await startMicrophone();
    } catch (err) {
      isConnectingRef.current = false;
      isGoAwayReconnectPendingRef.current = false;
      if (activeConnectionIdRef.current === connectionAttemptId) {
        activeConnectionIdRef.current = null;
      }
      const msg = err instanceof Error ? err.message : 'Unknown error';
      reportError(msg);
    }
  }, [voiceName, clearPlaybackQueue, clearReconnectTimeout, handleMessage, reportError, scheduleReconnect, startMicrophone, stopMicrophone]);

  connectRef.current = connect;

  useEffect(() => {
    if (enabled && voiceState === 'idle' && !sessionRef.current && !isConnectingRef.current) {
      void connect();
    }
  }, [enabled, voiceState, connect]);

  const disconnect = useCallback(() => {
    manualDisconnectRef.current = true;
    isConnectingRef.current = false;
    isGoAwayReconnectPendingRef.current = false;
    activeConnectionIdRef.current = null;
    clearReconnectTimeout();
    sessionHandleRef.current = null;
    inputTranscriptAccRef.current = '';
    outputTranscriptAccRef.current = '';
    const session = sessionRef.current;
    sessionRef.current = null; // null first so onmessage/worklet stops sending

    if (session) {
      finishActivity(session);
      try { session.close(); } catch { /* ignore */ }
    }
    stopMicrophone();
    clearPlaybackQueue();
    setVoiceState('idle');
    setMicLevel(0);
  }, [clearPlaybackQueue, clearReconnectTimeout, finishActivity, stopMicrophone]);

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
