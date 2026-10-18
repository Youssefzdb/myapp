import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Clapperboard, ArrowRight, ArrowLeft, Loader2, Sparkles, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { loadConfirmedModels } from '@/lib/opencode';
import { generateVideoPlan, shotImageUrl } from '@/lib/filmStudio';
import VideoPlayer from '@/components/studio/VideoPlayer';

const EXAMPLES = [
  'إعلان قصير لقهوة الصباح، إضاءة دافئة وبخار يتصاعد من الفنجان',
  'رحلة طائرة ورقية فوق تلال خضراء عند الغروب',
  'مقدمة فيلم خيال علمي: مدينة مستقبلية تمطر أضواء نيون',
];

export default function Studio() {
  const [models] = useState(() => { try { return loadConfirmedModels().models; } catch { return []; } });
  const [model, setModel] = useState('beam-free');
  const [effort, setEffort] = useState('low');
  const [idea, setIdea] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');
  const abortRef = useRef(null);

  const run = async () => {
    const text = idea.trim();
    if (!text || busy) return;
    setBusy(true); setError(''); setPlan(null); setStatus('ابدأ الإنتاج…');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const p = await generateVideoPlan({ idea: text, model, effort, signal: ctrl.signal, onStatus: setStatus });
      setPlan(p);
      setStatus('');
    } catch (e) {
      if (ctrl.signal.aborted) setStatus('تم الإلغاء.');
      else setError(e?.message || String(e));
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const abort = () => abortRef.current?.abort();

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <header className="h-14 border-b flex items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground grid place-items-center"><Clapperboard className="w-4 h-4" /></div>
          <div className="leading-none"><h1 className="text-sm font-semibold">Vibe Studio</h1><p className="text-[11px] text-muted-foreground mt-1">استوديو الفيديو بالذكاء الاصطناعي</p></div>
        </Link>
        <Button asChild variant="outline" size="sm"><Link to="/playground">العودة للبناء <ArrowLeft className="w-4 h-4 mr-1" /></Link></Button>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3.5 py-1.5 text-xs text-muted-foreground mb-4">
            <Sparkles className="w-3.5 h-3.5 text-primary" />من فكرة إلى فيديو — بالكامل في المتصفح
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">استوديو الفيديو</h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">صِف فكرتك، يكتب الـ AI السيناريو ويفكّكه إلى لقطات، ويولّد لوحة عمل وصوتًا — ثم يُشغّل الفيديو فورًا.</p>
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            rows={3}
            placeholder="صف فكرة الفيديو… مثال: إعلان قهوة الصباح بإضاءة دافئة وبخار يتصاعد"
            className="w-full resize-none rounded-xl border bg-background px-3.5 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 h-9 text-sm">
              <span className="text-muted-foreground text-xs">النموذج</span>
              <select value={model} onChange={(e) => setModel(e.target.value)} disabled={!models.length} className="bg-transparent outline-none text-sm max-w-[150px]">
                {!models.length && <option value={model}>{model}</option>}
                {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 h-9 text-sm">
              <span className="text-muted-foreground text-xs">التفكير</span>
              <select value={effort} onChange={(e) => setEffort(e.target.value)} className="bg-transparent outline-none text-sm">
                <option value="low">سريع</option><option value="medium">متوسط</option><option value="high">عميق</option>
              </select>
            </div>
            <div className="flex-1" />
            {busy ? (
              <Button variant="destructive" size="sm" onClick={abort}><span>إيقاف</span></Button>
            ) : (
              <Button size="sm" onClick={run} disabled={!idea.trim()}><Sparkles className="w-4 h-4 ml-1" />أنشئ الفيديو</Button>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button key={ex} onClick={() => setIdea(ex)} className="text-xs rounded-full border px-3 py-1.5 text-muted-foreground hover:bg-muted transition-colors">{ex}</button>
            ))}
          </div>
        </div>

        {(busy || status) && (
          <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}{status}
          </div>
        )}
        {error && <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm px-4 py-3">{error}</div>}

        {plan && (
          <div className="mt-8 space-y-6">
            <div>
              <VideoPlayer shots={plan.shots} />
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><ImageIcon className="w-4 h-4" />لوحة العمل — {plan.shots.length} لقطة</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {plan.shots.map((s) => (
                  <div key={s.id} className="rounded-xl border bg-card overflow-hidden">
                    <img src={shotImageUrl(s.imagePrompt, { seed: 1000 + (s.id || 0), width: 512, height: 288 })} alt="" loading="lazy" className="w-full aspect-video object-cover" />
                    <div className="p-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5"><span className="font-medium text-foreground">لقطة {s.id}</span><span>·</span><span>{s.durationSec}ث</span>{s.onScreenText && <><span>·</span><span>{s.onScreenText}</span></>}</div>
                      <p className="text-sm leading-relaxed line-clamp-3">{s.narration || '—'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}