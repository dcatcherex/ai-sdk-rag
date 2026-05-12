'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type DictationState = 'idle' | 'connecting' | 'listening' | 'error';
export type DictationLatencyMode = 'fast' | 'balanced' | 'accurate';

type LiveTranscriptItem = {
  itemId: string;
  partialText: string;
  finalText?: string;
};

type UseLiveTranscriptionOptions = {
  composerText: string;
  onComposerTextChange: (text: string) => void;
  onError?: (message: string) => void;
  language?: string;
  latencyMode?: DictationLatencyMode;
};

function appendWithSpacing(baseText: string, addition: string) {
  const nextPart = addition.trim();
  if (!nextPart) return baseText;
  if (!baseText.trim()) return nextPart;
  return /\s$/.test(baseText) ? `${baseText}${nextPart}` : `${baseText} ${nextPart}`;
}

function insertItemAfter(
  orderedItemIds: string[],
  itemId: string,
  previousItemId?: string | null,
) {
  if (orderedItemIds.includes(itemId)) {
    return orderedItemIds;
  }

  if (!previousItemId) {
    return [...orderedItemIds, itemId];
  }

  const previousIndex = orderedItemIds.indexOf(previousItemId);
  if (previousIndex === -1) {
    return [...orderedItemIds, itemId];
  }

  const next = [...orderedItemIds];
  next.splice(previousIndex + 1, 0, itemId);
  return next;
}

export function useLiveTranscription({
  composerText,
  onComposerTextChange,
  onError,
  language,
  latencyMode = 'balanced',
}: UseLiveTranscriptionOptions) {
  const [dictationState, setDictationState] = useState<DictationState>('idle');
  const [micLevel, setMicLevel] = useState(0);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const meterAnimationRef = useRef<number | null>(null);

  const composerTextRef = useRef(composerText);
  const lastAppliedTextRef = useRef(composerText);
  const sessionBaseTextRef = useRef('');
  const manualEditLockedRef = useRef(false);
  const orderedItemIdsRef = useRef<string[]>([]);
  const transcriptItemsRef = useRef<Map<string, LiveTranscriptItem>>(new Map());
  const settledItemIdsRef = useRef<Set<string>>(new Set());
  const isStartingRef = useRef(false);
  const isStoppingRef = useRef(false);

  const onComposerTextChangeRef = useRef(onComposerTextChange);
  onComposerTextChangeRef.current = onComposerTextChange;
  composerTextRef.current = composerText;

  const applyComposerText = useCallback((nextText: string) => {
    composerTextRef.current = nextText;
    lastAppliedTextRef.current = nextText;
    onComposerTextChangeRef.current(nextText);
  }, []);

  const getOrderedTranscriptText = useCallback((includePartials: boolean) => {
    let text = '';

    for (const itemId of orderedItemIdsRef.current) {
      const item = transcriptItemsRef.current.get(itemId);
      if (!item) continue;

      const nextChunk = item.finalText ?? (includePartials ? item.partialText : '');
      text = appendWithSpacing(text, nextChunk);
    }

    return text;
  }, []);

  const renderComposerFromTranscript = useCallback(() => {
    if (manualEditLockedRef.current) {
      return;
    }

    const transcriptText = getOrderedTranscriptText(true);
    const nextText = appendWithSpacing(sessionBaseTextRef.current, transcriptText);
    applyComposerText(nextText);
  }, [applyComposerText, getOrderedTranscriptText]);

  const appendFinalizedTurns = useCallback(() => {
    if (!manualEditLockedRef.current) {
      return;
    }

    let nextText = composerTextRef.current;

    for (const itemId of orderedItemIdsRef.current) {
      const item = transcriptItemsRef.current.get(itemId);
      if (!item?.finalText || settledItemIdsRef.current.has(itemId)) {
        continue;
      }

      nextText = appendWithSpacing(nextText, item.finalText);
      settledItemIdsRef.current.add(itemId);
    }

    if (nextText !== composerTextRef.current) {
      applyComposerText(nextText);
    }
  }, [applyComposerText]);

  const noteManualTextChange = useCallback((nextText: string) => {
    composerTextRef.current = nextText;

    if (dictationState !== 'connecting' && dictationState !== 'listening') {
      return;
    }

    if (nextText === lastAppliedTextRef.current) {
      return;
    }

    manualEditLockedRef.current = true;
    for (const itemId of orderedItemIdsRef.current) {
      settledItemIdsRef.current.add(itemId);
    }
  }, [dictationState]);

  const ensureItem = useCallback((itemId: string, previousItemId?: string | null) => {
    orderedItemIdsRef.current = insertItemAfter(orderedItemIdsRef.current, itemId, previousItemId);

    if (!transcriptItemsRef.current.has(itemId)) {
      transcriptItemsRef.current.set(itemId, {
        itemId,
        partialText: '',
      });
    }
  }, []);

  const reportError = useCallback((message: string) => {
    setDictationState('error');
    onError?.(message);
  }, [onError]);

  const stop = useCallback(() => {
    isStoppingRef.current = true;

    if (meterAnimationRef.current !== null) {
      window.cancelAnimationFrame(meterAnimationRef.current);
      meterAnimationRef.current = null;
    }

    dataChannelRef.current?.close();
    dataChannelRef.current = null;

    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }

    transcriptItemsRef.current.clear();
    orderedItemIdsRef.current = [];
    settledItemIdsRef.current.clear();
    manualEditLockedRef.current = false;
    isStartingRef.current = false;
    setMicLevel(0);
    setDictationState('idle');

    window.setTimeout(() => {
      isStoppingRef.current = false;
    }, 0);
  }, []);

  const handleRealtimeEvent = useCallback((payload: Record<string, unknown>) => {
    const type = typeof payload.type === 'string' ? payload.type : '';

    if (type === 'input_audio_buffer.committed') {
      const itemId = typeof payload.item_id === 'string' ? payload.item_id : '';
      const previousItemId = typeof payload.previous_item_id === 'string'
        ? payload.previous_item_id
        : null;
      if (itemId) {
        ensureItem(itemId, previousItemId);
      }
      return;
    }

    if (type === 'conversation.item.input_audio_transcription.delta') {
      const itemId = typeof payload.item_id === 'string' ? payload.item_id : '';
      const delta = typeof payload.delta === 'string' ? payload.delta : '';
      if (!itemId || !delta) {
        return;
      }

      ensureItem(itemId);
      const item = transcriptItemsRef.current.get(itemId);
      if (!item) return;

      item.partialText += delta;
      transcriptItemsRef.current.set(itemId, item);
      renderComposerFromTranscript();
      return;
    }

    if (type === 'conversation.item.input_audio_transcription.completed') {
      const itemId = typeof payload.item_id === 'string' ? payload.item_id : '';
      const transcript = typeof payload.transcript === 'string' ? payload.transcript : '';
      if (!itemId) {
        return;
      }

      ensureItem(itemId);
      const item = transcriptItemsRef.current.get(itemId);
      if (!item) return;

      item.finalText = transcript.trim();
      transcriptItemsRef.current.set(itemId, item);

      if (manualEditLockedRef.current) {
        appendFinalizedTurns();
      } else {
        renderComposerFromTranscript();
      }
      return;
    }

    if (type === 'conversation.item.input_audio_transcription.failed') {
      const error = payload.error as { message?: unknown } | undefined;
      stop();
      reportError(
        typeof error?.message === 'string'
          ? error.message
          : 'Realtime transcription failed.',
      );
      return;
    }

    if (type === 'error') {
      const error = payload.error as { message?: unknown } | undefined;
      stop();
      reportError(
        typeof error?.message === 'string'
          ? error.message
          : 'Realtime transcription connection failed.',
      );
    }
  }, [appendFinalizedTurns, ensureItem, renderComposerFromTranscript, reportError, stop]);

  const startMicMeter = useCallback((stream: MediaStream) => {
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;

    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const levelData = new Uint8Array(analyser.frequencyBinCount);
    const measure = () => {
      analyser.getByteFrequencyData(levelData);
      const average = levelData.reduce((sum, value) => sum + value, 0) / levelData.length;
      setMicLevel(average / 128);
      meterAnimationRef.current = window.requestAnimationFrame(measure);
    };

    meterAnimationRef.current = window.requestAnimationFrame(measure);
  }, []);

  const start = useCallback(async () => {
    if (
      isStartingRef.current
      || dictationState === 'connecting'
      || dictationState === 'listening'
    ) {
      return;
    }

    if (
      typeof window === 'undefined'
      || !window.RTCPeerConnection
      || !navigator.mediaDevices?.getUserMedia
    ) {
      reportError('This browser does not support live dictation.');
      return;
    }

    isStartingRef.current = true;
    isStoppingRef.current = false;
    manualEditLockedRef.current = false;
    transcriptItemsRef.current.clear();
    orderedItemIdsRef.current = [];
    settledItemIdsRef.current.clear();
    sessionBaseTextRef.current = composerTextRef.current;
    lastAppliedTextRef.current = composerTextRef.current;
    setDictationState('connecting');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      startMicMeter(stream);

      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;

      for (const track of stream.getTracks()) {
        pc.addTrack(track, stream);
      }

      pc.addEventListener('connectionstatechange', () => {
        if (isStoppingRef.current) {
          return;
        }

        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          stop();
          reportError('Live dictation connection was interrupted.');
        }
      });

      const dataChannel = pc.createDataChannel('oai-events');
      dataChannelRef.current = dataChannel;
      dataChannel.addEventListener('open', () => {
        setDictationState('listening');
      });
      dataChannel.addEventListener('message', (event: MessageEvent<string>) => {
        try {
          handleRealtimeEvent(JSON.parse(event.data) as Record<string, unknown>);
        } catch {
          // Ignore malformed events.
        }
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const response = await fetch('/api/realtime/transcription-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sdp: pc.localDescription?.sdp ?? offer.sdp,
          language,
          latencyMode,
        }),
      });

      const answerSdp = await response.text();
      if (!response.ok) {
        throw new Error(answerSdp || 'Failed to start live dictation.');
      }

      await pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp,
      });
    } catch (error) {
      stop();
      reportError(error instanceof Error ? error.message : 'Failed to start live dictation.');
      return;
    } finally {
      isStartingRef.current = false;
    }
  }, [dictationState, handleRealtimeEvent, language, latencyMode, reportError, startMicMeter, stop]);

  useEffect(() => () => {
    stop();
  }, [stop]);

  return {
    dictationState,
    isDictating: dictationState === 'connecting' || dictationState === 'listening',
    micLevel,
    noteManualTextChange,
    start,
    stop,
  };
}
