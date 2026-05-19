import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildRealtimeTranscriptionSessionConfig,
  hashRealtimeSafetyIdentifier,
  resolveOpenAIRealtimeTranscriptionModel,
} from './realtime-transcription';

test('realtime transcription config uses balanced defaults', () => {
  delete process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL;

  const config = buildRealtimeTranscriptionSessionConfig({});

  assert.equal(config.type, 'transcription');
  assert.deepEqual(config.audio.input.transcription, {
    model: 'gpt-realtime-whisper',
  });
  assert.equal('turn_detection' in config.audio.input, false);
});

test('realtime transcription config includes language hint when provided', () => {
  const config = buildRealtimeTranscriptionSessionConfig({ language: 'th' });

  assert.deepEqual(config.audio.input.transcription, {
    model: 'gpt-realtime-whisper',
    language: 'th',
  });
});

test('realtime transcription config maps accurate latency mode to slower VAD when model supports it', () => {
  process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL = 'gpt-4o-mini-transcribe';
  const config = buildRealtimeTranscriptionSessionConfig({ latencyMode: 'accurate' });

  assert.deepEqual(config.audio.input.turn_detection, {
    type: 'server_vad',
    threshold: 0.55,
    prefix_padding_ms: 400,
    silence_duration_ms: 800,
  });
  delete process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL;
});

test('realtime transcription model honors env override', () => {
  process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL = 'gpt-4o-transcribe';

  assert.equal(resolveOpenAIRealtimeTranscriptionModel(), 'gpt-4o-transcribe');

  delete process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL;
});

test('realtime safety identifier hashes the user id', () => {
  const first = hashRealtimeSafetyIdentifier('user_123');
  const second = hashRealtimeSafetyIdentifier('user_123');
  const third = hashRealtimeSafetyIdentifier('user_456');

  assert.equal(first, second);
  assert.notEqual(first, third);
  assert.equal(first.length, 64);
});
