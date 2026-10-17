import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Loader2, Lock, Globe, Copy, Check, UserPlus, X, LogIn, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { startBackendBridge, parseSpecString } from '@/lib/backendBridge';

export default function ViewApp() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState(null);
  const [error, setError] = useState('');
  const [srcDoc, setSrcDoc] = useState('');
  const [fallbackSrc, setFallbackSrc] = useState('');
  const [user, setUser] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMsg, setInviteMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const appIdRef = useRef(null);
  const specRef = useRef(null);

  useEffect(() => startBackendBridge({
    getAppId: () => appIdRef.current,
    getSpec: () => specRef.current,
  }), []);

  useEffect(() => {
    (async () => {
      try {
        let me = null;
        try {
          const authed = await base44.auth.isAuthenticated();
          if (authed) me = await base44.auth.me();
        } catch { /* anonymous */ }
        setUser(me);
        const rec = await base44.entities.PublishedApp.get(id);
        setRecord(rec);
        appIdRef.current = rec.id;
        specRef.current = parseSpecString(rec.backend_spec);
        setIsOwner(!!me && rec.created_by_id === me.id);
        let url = '';
        if (rec.visibility === 'public' && rec.content_url) {
          url = rec.content_url;
        } else if (rec.file_uri) {
          const r = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: rec.file_uri, expires_in: 3600 });
          url = r?.signed_url || '';
        }
        if (url) {
          setFallbackSrc(url);
          try {
            const r = await fetch(url, { mode: 'cors' });
            if (!r.ok) throw new Error('fetch status ' + r.status);
            const html = await r.text();
            if (html && /<div id="root">/.test(html)) setSrcDoc(html);
            else setSrcDoc('');
          } catch { /* CORS or network — fall back to src below */ }
        }
      } catch (e) {
        setError(e?.message || 'تعذّر الوصول. قد يكون التطبيق خاصًا وتحتاج لتسجيل الدخول أو دعوة.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const addInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setInviteMsg('بريد غير صالح'); return; }
    try {
      const invites = Array.from(new Set([...(record.invites || []), email]));
      const updated = await base44.entities.PublishedApp.update(record.id, { invites });
      setRecord(updated);
      setInviteEmail('');
      setInviteMsg('تمت إضافة الدعوة');
    } catch (e) { setInviteMsg(e?.message || 'تعذّر الإضافة'); }
  };

  const removeInvite = async (email) => {
    try {
      const invites = (record.invites || []).filter((e) => e !== email);
      const updated = await base44.entities.PublishedApp.update(record.id, { invites });
      setRecord(updated);
    } catch (e) { setInviteMsg(e?.message || 'تعذّر الحذف'); }
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/view/${record.id}`); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  if (loading) {
    return <div className="fixed inset-0 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <Lock className="w-10 h-10 mx-auto text-muted-foreground" />
          <h1 className="text-lg font-semibold">لا يمكن عرض هذا التطبيق</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={() => base44.auth.redirectToLogin(window.location.pathname)}>
            <LogIn className="w-4 h-4 mr-1" /> تسجيل الدخول
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="h-12 shrink-0 flex items-center justify-between gap-2 px-3 border-b bg-background">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-sm truncate">{record.title || 'تطبيق'}</span>
          <span className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full whitespace-nowrap ${record.visibility === 'public' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
            {record.visibility === 'public' ? <><Globe className="w-3 h-3" /> عام</> : <><Lock className="w-3 h-3" /> خاص</>}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={copyLink}>
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline mr-1">{copied ? 'تم النسخ' : 'نسخ الرابط'}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { window.location.href = '/'; }}>
            العودة للمولّد <ArrowRight className="w-3.5 h-3.5 mr-1" />
          </Button>
        </div>
      </header>

      {isOwner && record.visibility === 'private' && (
        <div className="shrink-0 border-b bg-muted/40 px-3 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Label className="text-xs whitespace-nowrap">إدارة الدعوات:</Label>
            <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="email@example.com" className="h-8 max-w-[220px]" dir="ltr" />
            <Button size="sm" onClick={addInvite}><UserPlus className="w-3.5 h-3.5 mr-1" />إضافة</Button>
            {inviteMsg && <span className="text-xs text-muted-foreground">{inviteMsg}</span>}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {(record.invites || []).map((em) => (
              <span key={em} className="inline-flex items-center gap-1 text-xs bg-background border rounded-full pr-2 pl-1 py-0.5" dir="ltr">
                {em}
                <button onClick={() => removeInvite(em)} className="text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
              </span>
            ))}
            {!(record.invites || []).length && <span className="text-xs text-muted-foreground">لا يوجد مدعوون بعد.</span>}
          </div>
        </div>
      )}

      {srcDoc ? (
        <iframe
          title="published-app"
          srcDoc={srcDoc}
          className="flex-1 w-full border-0 bg-white"
          sandbox="allow-scripts allow-popups"
        />
      ) : fallbackSrc ? (
        <iframe
          title="published-app"
          src={fallbackSrc}
          className="flex-1 w-full border-0 bg-white"
          sandbox="allow-scripts allow-popups allow-same-origin allow-forms allow-modals"
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">تعذّر تحميل المحتوى.</div>
      )}
    </div>
  );
}