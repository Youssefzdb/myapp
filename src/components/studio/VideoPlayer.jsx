import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { shotImageUrl } from '@/lib/filmStudio';

// Per-shot cinematic motion vectors (Ken Burns): subtle pan + zoom so every
// frame moves. Deterministic by shot id so a shot always moves the same way.
const MOTIONS = [
  { x: -6, y: 0, s: 0.12 },
  { x: 6, y: 0, s: 0.12 },
  { x: 0, y: -5, s: 0.10 },
  { x: 4, y: 3, s: 0.14 },
  { x: -4, y: -3, s: 0.12 },
];
const motionFor = (id) => MOTIONS[(Number(id) || 0) % MOTIONS.length];
const XFADE_MS = 800;

const img = (shot, w, h) => shotImageUrl(shot.imagePrompt, { seed: 1000 + (shot.id || 0), width: w, height: h });

export default function VideoPlayer({ shots }) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [muted, setMuted] = useState(false);
  const [prevIdx, setPrevIdx] = useState(null);
  const [xfade, setXfade] = useState(1); // 1 = previous shot fully covering, 0 = gone
  const [loaded, setLoaded] = useState({});
  const rafRef = useRef(null);
  const startRef = useRef(0);
  const xfadeStartRef = useRef(0);
  const mutedRef = useRef(false);

  const total = shots.reduce((a, s) => a + (s.durationSec || 4), 0);
  const shot = shots[idx];
  const prevShot = prevIdx != null ? shots[prevIdx] : null;

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
      u.lang = 'ar-SA'; u.rate = 0.98;
      window.speechSynthesis.speak(u);
    } catch {}
  }, []);

  useEffect(() => { mutedRef.current = muted; if (muted) try { window.speechSynthesis?.cancel(); } catch {} }, [muted]);

  useEffect(() => {
    if (!playing) { stop(); return; }
    if (!shot) return;
    speak(shot.narration || '');
    startRef.current = performance.now();
    const dur = (shot.durationSec || 4) * 1000;
    const tick = () => {
      const now = performance.now();
      const e = now - startRef.current;
      setProgress(Math.min(1, e / dur));
      if (xfadeStartRef.current) {
        const xf = (now - xfadeStartRef.current) / XFADE_MS;
        if (xf >= 1) { setXfade(0); setPrevIdx(null); xfadeStartRef.current = 0; }
        else setXfade(1 - xf);
      }
      if (e >= dur) {
        if (idx + 1 >= shots.length) { setPlaying(false); setProgress(1); return; }
        setPrevIdx(idx);
        setXfade(1);
        xfadeStartRef.current = now;
        setIdx((i) => i + 1);
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
      if (idx >= shots.length - 1 && progress >= 1) { setIdx(0); setProgress(0); setPrevIdx(null); setXfade(1); }
      setPlaying(true);
    }
  };
  const restart = () => { stop(); setIdx(0); setProgress(0); setPrevIdx(null); setXfade(1); setPlaying(true); };

  const overall = (shots.slice(0, idx).reduce((a, s) => a + (s.durationSec || 4), 0) + (shot?.durationSec || 4) * progress) / total;

  const transform = (s, p) => {
    const m = motionFor(s.id);
    return `scale(${1 + m.s * p}) translate(${m.x * p}%, ${m.y * p}%)`;
  };

  return (
    <div className="w-full">
      <div className="relative w-full overflow-hidden rounded-2xl border bg-black aspect-video">
        {/* Current shot (bottom layer, always opaque) */}
        {shot && (
          <img
            key={`cur-${shot.id}`}
            src={img(shot, 1024, 576)}
            alt=""
            onLoad={() => setLoaded((m) => ({ ...m, [shot.id]: true }))}
            style={{ transform: transform(shot, progress), transition: 'none' }}
            className={`absolute inset-0 w-full h-full object-cover will-change-transform ${loaded[shot.id] ? 'opacity-100' : 'opacity-0'}`}
          />
        )}
        {/* Previous shot fading out on top — crossfade, not a hard cut */}
        {prevShot && (
          <img
            key={`prev-${prevShot.id}`}
            src={img(prevShot, 1024, 576)}
            alt=""
            style={{ transform: transform(prevShot, 1), opacity: xfade }}
            className="absolute inset-0 w-full h-full object-cover will-change-[opacity]"
          />
        )}
        {!shot && <div className="absolute inset-0 grid place-items-center text-white/60 text-sm">لا توجد لقطات</div>}
        {shot?.onScreenText && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-lg bg-black/55 text-white text-sm font-medium backdrop-blur">{shot.onScreenText}</div>
        )}
        <div className="absolute top-0 inset-x-0 h-1 bg-white/15">
          <div className="h-full bg-primary" style={{ width: `${overall * 100}%` }} />
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