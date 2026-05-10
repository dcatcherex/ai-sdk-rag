'use client';

import { useState, useRef, useCallback } from 'react';
import { Volume2Icon, VolumeXIcon, LoaderIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';

type PlayState = 'idle' | 'loading' | 'playing';

export function ReadAloudButton({ text }: { text: string }) {
  const [playState, setPlayState] = useState<PlayState>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setPlayState('idle');
  }, []);

  const handleClick = useCallback(async () => {
    if (playState === 'playing' || playState === 'loading') {
      stop();
      return;
    }

    setPlayState('loading');

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        console.error('[ReadAloud] TTS error:', err);
        setPlayState('idle');
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onplay = () => setPlayState('playing');
      audio.onended = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        setPlayState('idle');
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        setPlayState('idle');
      };

      await audio.play();
    } catch (err) {
      console.error('[ReadAloud] Failed:', err);
      setPlayState('idle');
    }
  }, [playState, stop, text]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            onClick={handleClick}
            disabled={false}
          >
            {playState === 'loading' ? (
              <LoaderIcon className="size-3 animate-spin" />
            ) : playState === 'playing' ? (
              <VolumeXIcon className="size-3 text-blue-500" />
            ) : (
              <Volume2Icon className="size-3" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {playState === 'loading' ? 'Generating audio...' : playState === 'playing' ? 'Stop' : 'Read aloud'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ReadAloudMenuItem({ text }: { text: string }) {
  const [playState, setPlayState] = useState<PlayState>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setPlayState('idle');
  }, []);

  const handleSelect = useCallback(async (e: Event) => {
    e.preventDefault();
    if (playState === 'playing' || playState === 'loading') {
      stop();
      return;
    }
    setPlayState('loading');
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) { setPlayState('idle'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onplay = () => setPlayState('playing');
      audio.onended = () => { URL.revokeObjectURL(url); audioRef.current = null; setPlayState('idle'); };
      audio.onerror = () => { URL.revokeObjectURL(url); audioRef.current = null; setPlayState('idle'); };
      await audio.play();
    } catch { setPlayState('idle'); }
  }, [playState, stop, text]);

  const label = playState === 'loading' ? 'Generating audio...' : playState === 'playing' ? 'Stop reading' : 'Read aloud';
  const Icon = playState === 'loading' ? LoaderIcon : playState === 'playing' ? VolumeXIcon : Volume2Icon;

  return (
    <DropdownMenuItem onSelect={handleSelect}>
      <Icon className={`mr-2 size-4 ${playState === 'loading' ? 'animate-spin' : playState === 'playing' ? 'text-blue-500' : ''}`} />
      {label}
    </DropdownMenuItem>
  );
}
