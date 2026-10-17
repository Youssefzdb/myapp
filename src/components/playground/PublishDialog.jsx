import React, { useState } from 'react';
import { Rocket, Loader2, Copy, Check, Globe, Lock, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { publishApp } from '@/lib/publish';

export default function PublishDialog({ files, title }) {
  const [open, setOpen] = useState(false);
  const [appTitle, setAppTitle] = useState(title || '');
  const [vis, setVis] = useState('public');
  const [invites, setInvites] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [authed, setAuthed] = useState(null);

  const fileCount = Object.keys(files || {}).length;

  const checkAuth = async () => {
    try { setAuthed(await base44.auth.isAuthenticated()); } catch { setAuthed(false); }
  };

  const handlePublish = async () => {
    setError(''); setResult(null); setBusy(true);
    try {
      const inviteList = vis === 'private'
        ? invites.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)
        : [];
      const res = await publishApp({ files, title: appTitle, visibility: vis, invites: inviteList });
      setResult(res);
    } catch (e) {
      setError(e?.message || 'تعذّر النشر');
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(result.shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { checkAuth(); setResult(null); setError(''); } }}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm" disabled={!fileCount} title="نشر">
          <Rocket className="w-4 h-4 mr-1" />نشر
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Rocket className="w-5 h-5" /> نشر التطبيق على رابط حقيقي</DialogTitle>
        </DialogHeader>

        {authed === false ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">سجّل الدخول أولًا لنشر التطبيق.</p>
            <Button onClick={() => base44.auth.redirectToLogin()} className="w-full">تسجيل الدخول</Button>
          </div>
        ) : result ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <Check className="w-4 h-4" /> تم النشر بنجاح
            </div>
            <div className="flex items-center gap-2">
              <Input readOnly value={result.shareUrl} className="flex-1" dir="ltr" />
              <Button size="icon" variant="outline" onClick={copyLink}>
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <div className="flex gap-2">
              <a href={result.shareUrl} target="_blank" rel="noreferrer" className="flex-1">
                <Button variant="outline" className="w-full"><ExternalLink className="w-4 h-4 mr-1" />فتح الرابط</Button>
              </a>
              <Button variant="ghost" className="flex-1" onClick={() => setResult(null)}>نشر نسخة أخرى</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">عنوان التطبيق</Label>
              <Input value={appTitle} onChange={(e) => setAppTitle(e.target.value)} placeholder="تطبيق مُولّد" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">الظهور</Label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setVis('public')} className={`flex items-center gap-2 rounded-lg border p-2.5 text-xs ${vis === 'public' ? 'border-primary bg-primary/5' : 'border-input'}`}>
                  <Globe className="w-4 h-4 shrink-0" /> عام — أي شخص بالرابط
                </button>
                <button type="button" onClick={() => setVis('private')} className={`flex items-center gap-2 rounded-lg border p-2.5 text-xs ${vis === 'private' ? 'border-primary bg-primary/5' : 'border-input'}`}>
                  <Lock className="w-4 h-4 shrink-0" /> خاص — بالدعوة فقط
                </button>
              </div>
            </div>

            {vis === 'private' && (
              <div className="space-y-1.5">
                <Label className="text-xs">البريد المدعو (افصل بفاصلة أو سطر جديد)</Label>
                <Input value={invites} onChange={(e) => setInvites(e.target.value)} placeholder="a@x.com, b@y.com" dir="ltr" />
                <p className="text-[11px] text-muted-foreground">يصلون للرابط بتسجيل الدخول بهذا البريد.</p>
              </div>
            )}

            <Button onClick={handlePublish} disabled={busy || !fileCount} className="w-full">
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Rocket className="w-4 h-4 mr-2" />}
              {busy ? 'جارٍ النشر…' : 'نشر الآن'}
            </Button>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}