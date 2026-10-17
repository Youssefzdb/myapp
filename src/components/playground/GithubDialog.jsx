import React, { useState, useEffect, useRef } from 'react';
import { Github, Loader2, UploadCloud, Unlink, CheckCircle2, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { base44 } from '@/api/base44Client';
import { GITHUB_CONNECTOR_ID, checkGithub, disconnectGithub, pushProjectToGithub } from '@/lib/github';

export default function GithubDialog({ files, autoPush, onAutoPushChange, onConnectedChange }) {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [connected, setConnected] = useState(false);
  const [login, setLogin] = useState('');
  const [avatar, setAvatar] = useState('');
  const [repo, setRepo] = useState('vibe-app');
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const popupRef = useRef(null);

  const fileCount = Object.keys(files || {}).length;

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const authed = await base44.auth.isAuthenticated();
      if (!authed) {
        setUser(null);
        setConnected(false);
        onConnectedChange?.(false);
        setLoading(false);
        return;
      }
      const me = await base44.auth.me();
      setUser(me);
      try {
        const data = await checkGithub();
        setConnected(true);
        setLogin(data.login);
        setAvatar(data.avatar || '');
        onConnectedChange?.(true);
      } catch (e) {
        setConnected(false);
        setLogin('');
        setAvatar('');
        setError(e.response?.data?.error || e.message || 'تعذّر التحقق من ربط GitHub');
        onConnectedChange?.(false);
      }
    } catch (e) {
      setConnected(false);
      setError(e.response?.data?.error || e.message || 'تعذّر التحقق من الحساب');
      onConnectedChange?.(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const onReturn = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', onReturn);
    document.addEventListener('visibilitychange', onReturn);
    return () => {
      window.removeEventListener('focus', onReturn);
      document.removeEventListener('visibilitychange', onReturn);
    };
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  const handleConnect = async () => {
    setError('');
    try {
      const url = await base44.connectors.connectAppUser(GITHUB_CONNECTOR_ID);
      const popup = window.open(url, '_blank');
      popupRef.current = popup;
      const timer = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(timer);
          refresh();
        }
      }, 600);
    } catch (e) {
      setError(e.message || 'تعذّر بدء الربط');
    }
  };

  const handleDisconnect = async () => {
    setError('');
    try {
      await disconnectGithub();
      setConnected(false);
      setLogin('');
      setAvatar('');
      onConnectedChange?.(false);
      setResult(null);
    } catch (e) {
      setError(e.message || 'تعذّر فصل الربط');
    }
  };

  const handlePush = async () => {
    setError('');
    setResult(null);
    if (!fileCount) {
      setError('لا يوجد كود لرفعه بعد');
      return;
    }
    setPushing(true);
    try {
      const data = await pushProjectToGithub({ files, repo, private: isPrivate, commitMessage: 'chore: push generated app' });
      if (data?.error) throw new Error(data.error);
      setResult(data);
      onConnectedChange?.(true);
    } catch (e) {
      setError(e.message || 'تعذّر رفع الكود');
    } finally {
      setPushing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="GitHub" className={connected ? 'text-green-600' : ''}>
          <Github className="w-4 h-4" />
          {connected && <span className="hidden sm:inline ml-1 text-xs">متصل</span>}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="w-5 h-5" /> ربط GitHub
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : !user ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">سجّل الدخول أولًا لربط حسابك على GitHub.</p>
            <Button onClick={() => base44.auth.redirectToLogin()} className="w-full">تسجيل الدخول</Button>
          </div>
        ) : !connected ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">اربط حساب GitHub الخاص بك ليتمكن التطبيق (والـ AI) من رفع الكود المُولّد إلى مستودعاتك تلقائيًا.</p>
            <Button onClick={handleConnect} className="w-full">
              <Github className="w-4 h-4 mr-2" /> ربط حساب GitHub
            </Button>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border p-2.5">
              {avatar && <img src={avatar} alt="" className="w-7 h-7 rounded-full" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> {login}
                </p>
                <p className="text-xs text-muted-foreground">حسابك مرتبط</p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleDisconnect} title="إلغاء الربط">
                <Unlink className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">اسم المستودع</Label>
              <Input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="vibe-app" />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs">مستودع خاص</Label>
              <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs">رفع تلقائي بعد كل بناء</Label>
                <p className="text-[11px] text-muted-foreground">الـ AI يرفع الكود تلقائيًا بعد اكتماله</p>
              </div>
              <Switch checked={autoPush} onCheckedChange={onAutoPushChange} />
            </div>

            <Button onClick={handlePush} disabled={pushing || !fileCount} className="w-full">
              {pushing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UploadCloud className="w-4 h-4 mr-2" />}
              {pushing ? 'جارٍ الرفع…' : 'رفع الكود الآن'}
            </Button>

            {result?.url && (
              <a href={result.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-green-600 hover:underline">
                <ExternalLink className="w-3.5 h-3.5" /> {result.url} ({result.files} ملف)
              </a>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}