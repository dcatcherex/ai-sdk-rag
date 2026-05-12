'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActivatedSkillBadge, VoiceToolCallMetadata, VoiceTurnMetadata } from '@/features/chat/types';

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
  provider?: 'openai' | 'gemini';
  voiceName?: string;
  onError?: (message: string) => void;
  onTurnComplete?: (userText: string, aiText: string, metadata?: VoiceTurnMetadata) => void | Promise<void>;
  history?: VoiceHistoryTurn[];
  getRealtimeContext?: () => Promise<RealtimeVoiceClientContext>;
};

export type RealtimeVoiceClientContext = {
  threadId: string;
  agentId?: string | null;
  model?: string;
  enabledModelIds?: string[];
  selectedDocumentIds?: string[];
  useWebSearch?: boolean;
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
const OPENAI_WAIT_FOR_USER_TOOL_NAME = 'wait_for_user';

function decodeHeaderJson<T>(value: string | null): T | undefined {
  if (!value) return undefined;

  try {
    return JSON.parse(decodeURIComponent(value)) as T;
  } catch {
    return undefined;
  }
}

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

export function useLiveVoice({
  enabled,
  provider = 'openai',
  voiceName,
  onError,
  onTurnComplete,
  history,
  getRealtimeContext,
}: UseLiveVoiceOptions) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState<VoiceTurn[]>([]);
  const [micLevel, setMicLevel] = useState(0);
  const [speakAloud, setSpeakAloudState] = useState(true);

  // Internal refs — not state so they don't cause re-renders
  const sessionRef = useRef<LiveWebSocketSession | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const openAIContextRef = useRef<(RealtimeVoiceClientContext & {
    voiceName?: string | null;
    history?: VoiceHistoryTurn[];
  }) | null>(null);
  const voiceSessionMetadataRef = useRef<VoiceTurnMetadata | null>(null);
  const openAITurnToolCallsRef = useRef<VoiceToolCallMetadata[]>([]);
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
  const meterAnimationRef = useRef<number | null>(null);
  const openAIFinalizeTimeoutRef = useRef<number | null>(null);
  const pendingOpenAIToolCallsRef = useRef(0);
  const activeConnectionIdRef = useRef<symbol | null>(null);
  const enabledRef = useRef(enabled);
  const manualDisconnectRef = useRef(false);
  const isConnectingRef = useRef(false);
  const isGoAwayReconnectPendingRef = useRef(false);
  const isActivityActiveRef = useRef(false);
  const lowActivityChunkCountRef = useRef(0);
  const connectRef = useRef<(() => Promise<void>) | null>(null);
  const providerRef = useRef(provider);

  enabledRef.current = enabled;
  providerRef.current = provider;

  const reportError = useCallback((msg: string) => {
    setVoiceState('error');
    onError?.(msg);
  }, [onError]);

  const clearOpenAIFinalizeTimeout = useCallback(() => {
    if (openAIFinalizeTimeoutRef.current !== null) {
      window.clearTimeout(openAIFinalizeTimeoutRef.current);
      openAIFinalizeTimeoutRef.current = null;
    }
  }, []);

  const buildCurrentVoiceTurnMetadata = useCallback((): VoiceTurnMetadata | undefined => {
    const sessionMetadata = voiceSessionMetadataRef.current;
    if (!sessionMetadata) return undefined;

    const activatedSkills = sessionMetadata.activatedSkills?.length
      ? sessionMetadata.activatedSkills
      : undefined;
    const toolCalls = openAITurnToolCallsRef.current.length > 0
      ? openAITurnToolCallsRef.current.slice()
      : undefined;

    return {
      provider: sessionMetadata.provider,
      ...(sessionMetadata.realtimeModel ? { realtimeModel: sessionMetadata.realtimeModel } : {}),
      ...(activatedSkills ? { activatedSkills } : {}),
      ...(toolCalls ? { toolCalls } : {}),
    };
  }, []);

  const finalizeOpenAITurn = useCallback(() => {
    clearOpenAIFinalizeTimeout();
    if (pendingOpenAIToolCallsRef.current > 0) return;

    const userText = inputTranscriptAccRef.current.trim();
    const aiText = outputTranscriptAccRef.current.trim();
    if (!userText && !aiText) {
      setVoiceState('listening');
      return;
    }
    if (userText && !aiText) {
      return;
    }

    inputTranscriptAccRef.current = '';
    outputTranscriptAccRef.current = '';
    const metadata = buildCurrentVoiceTurnMetadata();
    openAITurnToolCallsRef.current = [];
    setTranscript((prev) => prev.map((turn) => turn.partial ? { ...turn, partial: false } : turn));
    onTurnCompleteRef.current?.(userText, aiText, metadata);
    setVoiceState('listening');
  }, [buildCurrentVoiceTurnMetadata, clearOpenAIFinalizeTimeout]);

  const scheduleOpenAITurnFinalize = useCallback(() => {
    clearOpenAIFinalizeTimeout();
    openAIFinalizeTimeoutRef.current = window.setTimeout(finalizeOpenAITurn, 250);
  }, [clearOpenAIFinalizeTimeout, finalizeOpenAITurn]);

  const completeOpenAIWaitForUserTurn = useCallback(() => {
    clearOpenAIFinalizeTimeout();
    inputTranscriptAccRef.current = '';
    outputTranscriptAccRef.current = '';
    openAITurnToolCallsRef.current = [];
    setTranscript((prev) => {
      const next = [...prev];
      while (next.at(-1)?.partial) {
        next.pop();
      }
      return next;
    });
    setVoiceState('listening');
  }, [clearOpenAIFinalizeTimeout]);

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
        onTurnCompleteRef.current?.(userText, aiText, buildCurrentVoiceTurnMetadata());
      }
      setVoiceState('listening');
    }
  }, [buildCurrentVoiceTurnMetadata, clearPlaybackQueue, enqueueAudio]);

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
    if (meterAnimationRef.current !== null) {
      window.cancelAnimationFrame(meterAnimationRef.current);
      meterAnimationRef.current = null;
    }
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

  const startOpenAIMicrophoneMeter = useCallback((stream: MediaStream) => {
    const ctx = new AudioContext();
    audioContextRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const levelData = new Uint8Array(analyser.frequencyBinCount);
    const measureLevel = () => {
      if (!streamRef.current || providerRef.current !== 'openai') return;
      analyser.getByteFrequencyData(levelData);
      const avg = levelData.reduce((a, b) => a + b, 0) / levelData.length;
      setMicLevel(avg / 128);
      meterAnimationRef.current = requestAnimationFrame(measureLevel);
    };
    meterAnimationRef.current = requestAnimationFrame(measureLevel);
  }, []);

  const closeOpenAIConnection = useCallback(() => {
    clearOpenAIFinalizeTimeout();
    pendingOpenAIToolCallsRef.current = 0;
    dataChannelRef.current?.close();
    dataChannelRef.current = null;
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current = null;
    }
    openAIContextRef.current = null;
    voiceSessionMetadataRef.current = null;
    openAITurnToolCallsRef.current = [];
  }, [clearOpenAIFinalizeTimeout]);

  const sendOpenAIEvent = useCallback((event: Record<string, unknown>) => {
    const channel = dataChannelRef.current;
    if (!channel || channel.readyState !== 'open') return;
    channel.send(JSON.stringify(event));
  }, []);

  const runOpenAIToolCall = useCallback(async (event: Record<string, unknown>) => {
    const context = openAIContextRef.current;
    const callId = typeof event.call_id === 'string' ? event.call_id : '';
    const toolName = typeof event.name === 'string' ? event.name : '';
    const argumentsJson = typeof event.arguments === 'string' ? event.arguments : '{}';
    if (!context || !callId || !toolName) return;

    pendingOpenAIToolCallsRef.current += 1;
    const startedAt = performance.now();
    try {
      const response = await fetch('/api/realtime/tool-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context,
          callId,
          toolName,
          argumentsJson,
        }),
      });
      const payload = await response.json() as { output?: unknown; error?: string };
      const output = response.ok
        ? payload.output
        : { error: payload.error ?? 'Tool call failed' };
      openAITurnToolCallsRef.current.push({
        name: toolName,
        callId,
        ok: response.ok,
        durationMs: Math.round(performance.now() - startedAt),
        ...(!response.ok ? { error: payload.error ?? 'Tool call failed' } : {}),
      });

      sendOpenAIEvent({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: callId,
          output: JSON.stringify(output ?? null),
        },
      });
      if (toolName === OPENAI_WAIT_FOR_USER_TOOL_NAME) {
        completeOpenAIWaitForUserTurn();
        return;
      }
      sendOpenAIEvent({ type: 'response.create' });
    } catch (error) {
      openAITurnToolCallsRef.current.push({
        name: toolName,
        callId,
        ok: false,
        durationMs: Math.round(performance.now() - startedAt),
        error: error instanceof Error ? error.message : 'Tool call failed',
      });
      sendOpenAIEvent({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: callId,
          output: JSON.stringify({
            error: error instanceof Error ? error.message : 'Tool call failed',
          }),
        },
      });
      if (toolName === OPENAI_WAIT_FOR_USER_TOOL_NAME) {
        completeOpenAIWaitForUserTurn();
        return;
      }
      sendOpenAIEvent({ type: 'response.create' });
    } finally {
      pendingOpenAIToolCallsRef.current = Math.max(0, pendingOpenAIToolCallsRef.current - 1);
    }
  }, [completeOpenAIWaitForUserTurn, sendOpenAIEvent]);

  const handleOpenAIMessage = useCallback((message: Record<string, unknown>) => {
    const type = typeof message.type === 'string' ? message.type : '';

    if (type === 'error') {
      const error = message.error as { message?: string } | undefined;
      reportError(error?.message ?? 'Realtime voice error');
      return;
    }

    if (type === 'input_audio_buffer.speech_started') {
      clearOpenAIFinalizeTimeout();
      outputTranscriptAccRef.current = '';
      setVoiceState('listening');
      return;
    }

    if (
      type === 'conversation.item.input_audio_transcription.delta' ||
      type === 'conversation.item.input_audio_transcription.segment'
    ) {
      const delta = typeof message.delta === 'string'
        ? message.delta
        : typeof message.text === 'string'
          ? message.text
          : '';
      if (!delta) return;
      inputTranscriptAccRef.current += delta;
      const text = inputTranscriptAccRef.current;
      setTranscript((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'user' && last.partial) {
          return [...prev.slice(0, -1), { role: 'user', text, partial: true }];
        }
        return [...prev, { role: 'user', text, partial: true }];
      });
      return;
    }

    if (type === 'conversation.item.input_audio_transcription.completed') {
      const transcriptText = typeof message.transcript === 'string' ? message.transcript : '';
      if (transcriptText) {
        inputTranscriptAccRef.current = transcriptText;
        setTranscript((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'user' && last.partial) {
            return [...prev.slice(0, -1), { role: 'user', text: transcriptText, partial: true }];
          }
          return [...prev, { role: 'user', text: transcriptText, partial: true }];
        });
      }
      return;
    }

    if (type === 'response.created' || type === 'response.output_audio.delta') {
      setVoiceState('ai-speaking');
      return;
    }

    if (type === 'response.output_audio_transcript.delta' || type === 'response.output_text.delta') {
      const delta = typeof message.delta === 'string' ? message.delta : '';
      if (!delta) return;
      outputTranscriptAccRef.current += delta;
      const text = outputTranscriptAccRef.current;
      setTranscript((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'ai' && last.partial) {
          return [...prev.slice(0, -1), { role: 'ai', text, partial: true }];
        }
        return [...prev, { role: 'ai', text, partial: true }];
      });
      return;
    }

    if (type === 'response.output_audio_transcript.done' || type === 'response.output_text.done') {
      const text = typeof message.transcript === 'string'
        ? message.transcript
        : typeof message.text === 'string'
          ? message.text
          : outputTranscriptAccRef.current;
      if (text) {
        outputTranscriptAccRef.current = text;
        setTranscript((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'ai' && last.partial) {
            return [...prev.slice(0, -1), { role: 'ai', text, partial: true }];
          }
          return [...prev, { role: 'ai', text, partial: true }];
        });
      }
      scheduleOpenAITurnFinalize();
      return;
    }

    if (type === 'response.function_call_arguments.done') {
      void runOpenAIToolCall(message);
      return;
    }

    if (type === 'response.done') {
      scheduleOpenAITurnFinalize();
    }
  }, [clearOpenAIFinalizeTimeout, reportError, runOpenAIToolCall, scheduleOpenAITurnFinalize]);

  const connectOpenAI = useCallback(async (connectionAttemptId: symbol) => {
    if (!getRealtimeContext) {
      throw new Error('Realtime voice context is not configured');
    }

    const baseContext = await getRealtimeContext();
    const context = {
      ...baseContext,
      voiceName: voiceName ?? null,
      history: historyRef.current ?? [],
    };
    openAIContextRef.current = context;

    const pc = new RTCPeerConnection();
    peerConnectionRef.current = pc;

    const remoteAudio = new Audio();
    remoteAudio.autoplay = true;
    remoteAudio.muted = !speakAloudRef.current;
    remoteAudioRef.current = remoteAudio;
    pc.ontrack = (event) => {
      remoteAudio.srcObject = event.streams[0] ?? null;
      void remoteAudio.play().catch(() => {
        // Browser autoplay can be finicky; the active click usually unlocks it.
      });
    };

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    streamRef.current = stream;
    startOpenAIMicrophoneMeter(stream);
    for (const track of stream.getAudioTracks()) {
      pc.addTrack(track, stream);
    }

    const dataChannel = pc.createDataChannel('oai-events');
    dataChannelRef.current = dataChannel;
    dataChannel.addEventListener('open', () => {
      if (activeConnectionIdRef.current !== connectionAttemptId) return;
      isConnectingRef.current = false;
      setVoiceState('listening');
    });
    dataChannel.addEventListener('message', (event: MessageEvent<string>) => {
      if (activeConnectionIdRef.current !== connectionAttemptId) return;
      try {
        handleOpenAIMessage(JSON.parse(event.data) as Record<string, unknown>);
      } catch (error) {
        console.error('[useLiveVoice] invalid OpenAI realtime event:', error, event.data);
      }
    });

    pc.addEventListener('connectionstatechange', () => {
      if (activeConnectionIdRef.current !== connectionAttemptId) return;
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        reportError(`Realtime connection ${pc.connectionState}`);
      }
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    if (!offer.sdp) {
      throw new Error('Failed to create realtime voice offer');
    }

    const response = await fetch('/api/realtime/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...context,
        sdp: offer.sdp,
      }),
    });

    const answerSdp = await response.text();
    if (!response.ok) {
      throw new Error(answerSdp || 'Failed to create realtime session');
    }

    voiceSessionMetadataRef.current = {
      provider: 'openai',
      realtimeModel: response.headers.get('X-Vaja-Realtime-Model') ?? undefined,
      activatedSkills: decodeHeaderJson<ActivatedSkillBadge[]>(
        response.headers.get('X-Vaja-Realtime-Activated-Skills'),
      ) ?? [],
    };

    if (activeConnectionIdRef.current !== connectionAttemptId) {
      pc.close();
      return;
    }

    await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
  }, [getRealtimeContext, handleOpenAIMessage, reportError, startOpenAIMicrophoneMeter, voiceName]);

  // ── Connect / Disconnect ───────────────────────────────────────────────────

  const connect = useCallback(async () => {
    if (sessionRef.current || peerConnectionRef.current || isConnectingRef.current) return;
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
      if (providerRef.current === 'openai') {
        await connectOpenAI(connectionAttemptId);
        return;
      }

      // Get ephemeral token from our backend
      const res = await fetch('/api/live-token');
      if (!res.ok) throw new Error('Failed to get live token');
      const { token, model } = await res.json() as { token: string; model?: string };
      if (!model || model.trim().length === 0) {
        throw new Error('Live token response missing model');
      }
      voiceSessionMetadataRef.current = {
        provider: 'gemini',
        realtimeModel: model,
      };

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
            if (input.activityStart) console.log('[Live WS] -> send activityStart');
            if (input.activityEnd) console.log('[Live WS] -> send activityEnd');
            socket.send(JSON.stringify({ realtimeInput: input }));
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
              mediaResolution: 'MEDIA_RESOLUTION_MEDIUM',
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
            contextWindowCompression: {
              triggerTokens: '104857',
              slidingWindow: { targetTokens: '52428' },
            },
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
            const message = JSON.parse(dataText) as Record<string, any>;
            if (!message.serverContent?.modelTurn?.parts?.[0]?.inlineData) {
              console.log('[Live WS] <- recv:', Object.keys(message), message.serverContent ? Object.keys(message.serverContent) : '');
            }
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
      closeOpenAIConnection();
      stopMicrophone();
      if (activeConnectionIdRef.current === connectionAttemptId) {
        activeConnectionIdRef.current = null;
      }
      const msg = err instanceof Error ? err.message : 'Unknown error';
      reportError(msg);
    }
  }, [voiceName, clearPlaybackQueue, clearReconnectTimeout, closeOpenAIConnection, connectOpenAI, handleMessage, reportError, scheduleReconnect, startMicrophone, stopMicrophone]);

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
    voiceSessionMetadataRef.current = null;
    openAITurnToolCallsRef.current = [];
    const session = sessionRef.current;
    sessionRef.current = null; // null first so onmessage/worklet stops sending

    if (session) {
      finishActivity(session);
      try { session.close(); } catch { /* ignore */ }
    }
    closeOpenAIConnection();
    stopMicrophone();
    clearPlaybackQueue();
    setVoiceState('idle');
    setMicLevel(0);
  }, [clearPlaybackQueue, clearReconnectTimeout, closeOpenAIConnection, finishActivity, stopMicrophone]);

  const toggleSpeakAloud = useCallback(() => {
    speakAloudRef.current = !speakAloudRef.current;
    setSpeakAloudState(speakAloudRef.current);
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = !speakAloudRef.current;
    }
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
