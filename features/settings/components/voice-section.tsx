'use client';

import { useRef, useState } from 'react';
import { CheckIcon, MicIcon, PauseIcon, PlayIcon } from 'lucide-react';
import { VOICE_METADATA } from '@/lib/voice-metadata';

const DEFAULT_VOICE = 'Aoede';

type Props = {
  selectedVoice: string | null;
  onSelect: (voice: string | null) => void;
};

export function VoiceSection({ selectedVoice, onSelect }: Props) {
  const effectiveVoice = selectedVoice ?? DEFAULT_VOICE;
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [filter, setFilter] = useState<'all' | 'male' | 'female'>('all');

  const voices = Object.values(VOICE_METADATA).filter(
    (v) => filter === 'all' || v.sex === filter,
  );

  const handlePreview = (voiceName: string, audioFile: string) => {
    if (playingVoice === voiceName) {
      audioRef.current?.pause();
      setPlayingVoice(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(audioFile);
    audioRef.current = audio;
    audio.play().catch(() => {/* no audio file yet */});
    setPlayingVoice(voiceName);
    audio.onended = () => setPlayingVoice(null);
  };

  return (
    <section className="border-t border-black/5 dark:border-border pt-6">
      <div className="flex items-center gap-2 mb-1">
        <MicIcon className="size-5 text-muted-foreground" />
        <h3 className="text-base font-semibold">Voice</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Choose a voice for real-time voice chat. Click the play button to preview.
      </p>

      {/* Filter pills */}
      <div className="flex gap-2 mb-4">
        {(['all', 'female', 'male'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === f
                ? 'bg-primary text-primary-foreground'
                : 'bg-black/5 dark:bg-white/8 text-muted-foreground hover:text-foreground'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {voices.map((voice) => {
          const isSelected = voice.name === effectiveVoice;
          const isPlaying = playingVoice === voice.name;
          return (
            <div
              key={voice.name}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(voice.name === DEFAULT_VOICE ? null : voice.name)}
              onKeyDown={(e) => e.key === 'Enter' && onSelect(voice.name === DEFAULT_VOICE ? null : voice.name)}
              className={`relative flex flex-col gap-1 rounded-xl border px-3 py-3 text-left transition-all cursor-pointer ${
                isSelected
                  ? 'border-primary bg-primary/5 dark:bg-primary/10'
                  : 'border-black/8 dark:border-border hover:border-black/20 dark:hover:border-white/20'
              }`}
            >
              {isSelected && (
                <span className="absolute top-2 right-2 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <CheckIcon className="size-2.5" />
                </span>
              )}
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold leading-tight">{voice.name}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePreview(voice.name, voice.audioFile);
                  }}
                  className="ml-auto shrink-0 flex size-6 items-center justify-center rounded-full bg-black/6 dark:bg-white/8 hover:bg-primary/15 transition-colors"
                >
                  {isPlaying ? (
                    <PauseIcon className="size-3" />
                  ) : (
                    <PlayIcon className="size-3" />
                  )}
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    voice.sex === 'female'
                      ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  }`}
                >
                  {voice.sex}
                </span>
                <span className="text-[11px] text-muted-foreground capitalize">{voice.tone}</span>
              </div>
              <span className="text-[10px] text-muted-foreground/70 capitalize">{voice.pitch} pitch</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
