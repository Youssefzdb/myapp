import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { shotImageUrl } from '@/lib/filmStudio';

export default function VideoPlayer({ shots, onReplay }) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1 within current shot
  const [muted, setMuted] = useState(false);
  const [loaded, setLoaded] = useState({});
  const rafRef = useRef(null);
  const startRef = useRef(0);
  const mutedRef = useRef(false);

  const total = shots.reduce((a, s) => a + (s.durationSec || 4), 0);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    try { window.speechSynthesis?.cancel(); } catch {}
  }, []);

  const speak = useCallback((text) => {
    if (mutedRef.current || !text) { try { window.speechSynthesis?.cancel(); } catch {} return; }
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ar-SA'; u.rate = 0.98; u.pitch = 1;
      window.speechSynthesis.speak(u);
    } catch {}
  }, []);

  useEffect(() => {
    mutedRef.current = muted;
    if (muted) try { window.speechSynthesis?.cancel(); } catch {}
    else if (playing) speak(shots[idx]?.narration || '');
  }, [muted]);

  useEffect(() => {
    if (!playing) { stop(); return; }
    const shot = shots[idx];
    if (!shot) return;
    speak(shot.narration || '');
    startRef.current = performance.now();
    const dur = (shot.durationSec || 4) * 1000;
    const tick = () => {
      const e = performance.now() - startRef.current;
      setProgress(Math.min(1, e / dur));
      if (e >= dur) {
        if (idx + 1 >= shots.length) { setPlaying(false); setProgress(1); }
        else setIdx((i) => i + 1);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => stop();
  }, [playing, idx, shots]);

  useEffect(() => () => stop(), [stop]);

  const toggle = () => {
    if (playing) setPlaying(false);
    else {
      if (idx >= shots.length - 1 && progress >= 1) { setIdx(0); setProgress(0); }
      setPlaying(true);
    }
  };
  const restart = () => { stop(); setIdx(0); setProgress(0); setPlaying(true); };

  const overall = (shots.slice(0, idx).reduce((a, s) => a + (s.durationSec || 4), 0) + (shots[idx]?.durationSec || 4) * progress) / total;

  const shot = shots[idx];

  return (
    <div className="w-full">
      <div className="relative w-full overflow-hidden rounded-2xl border bg-black aspect-video">
        {shot && (
          <img
            key={shot.id}
            src={shotImageUrl(shot.imagePrompt, { seed: 1000 + (shot.id || 0) })}
            alt={shot.onScreenText || ''}
            onLoad={() => setLoaded((m) => ({ ...m, [shot.id]: true }))}
            style={{ transitionDuration: '6000ms', transitionTimingFunction: 'ease-out' }}
            className={`w-full h-full object-cover transition-transform ${playing ? 'scale-110' : 'scale-100'} ${loaded[shot.id] ? 'opacity-100' : 'opacity-0'}`}
          />
        )}
        {!shot && <div className="absolute inset-0 grid place-items-center text-white/60 text-sm">لا توجد لقطات</div>}
        {shot?.onScreenText && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-lg bg-black/55 text-white text-sm font-medium backdrop-blur">{shot.onScreenText}</div>
        )}
        <div className="absolute top-0 inset-x-0 h-1 bg-white/15">
          <div className="h-full bg-primary transition-[width] duration-100" style={{ width: `${overall * 100}%` }} />
        </div>
        <div className="absolute top-2 right-2 text-[11px] text-white/70 bg-black/40 px-1.5 py-0.5 rounded">
          {idx + 1}/{shots.length}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button onClick={toggle} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm">
          {playing ? <><Pause className="w-4 h-4" />إيقاف</> : <><Play className="w-4 h-4" />تشغيل</>}
        </button>
        <button onClick={restart} className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl border text-sm">
          <RotateCcw className="w-4 h-4" />إعادة
        </button>
        <button onClick={() => setMuted((m) => !m)} className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl border text-sm">
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}{muted ? 'صامت' : 'صوت'}
        </button>
        <span className="text-xs text-muted-foreground mr-auto">المدة ≈ {Math.round(total)}ث</span>
      </div>

      <p className="mt-3 text-sm text-muted-foreground leading-relaxed min-h-[2.5rem]">
        {shot ? `«${shot.narration || '…'}»` : ''}
      </p>
    </div>
  );
}