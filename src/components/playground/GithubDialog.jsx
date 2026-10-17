import React, { useState, useEffect } from 'react';
import { Github, Loader2, UploadCloud, Unlink, CheckCircle2, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useNavigate } from 'react-router-dom';
import { checkGithub, pushProjectToGithub, getGithubConfig } from '@/lib/github';
import { getSession, getGithubToken, setGithubToken, clearGithubToken } from '@/lib/customAuth';

export default function GithubDialog({ files, autoPush, onAutoPushChange, onConnectedChange }) {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [connected, setConnected] = useState(false);
  const [login, setLogin] = useState('');
  const [avatar, setAvatar] = useState('');
  const [repo, setRepo] = useState('vibe-app');
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const fileCount = Object.keys(files || {}).length;

  const refresh = async () => {
    setLoading(true);
    setError('');
    const session = getSession();
    if (!session) {
      setUser(null);
      setConnected(false);
      onConnectedChange?.(false);
      setLoading(false);
      return;
    }
    setUser(session);
    const token = getGithubToken();
    if (!token) {
      setConnected(false);
      setLogin('');
      setAvatar('');
      onConnectedChange?.(false);
      setLoading(false);
      return;
    }
    try {
      const data = await checkGithub(token);
      setConnected(true);
      setLogin(data.login);
      setAvatar(data.avatar || '');
      onConnectedChange?.(true);
    } catch (e) {
      setConnected(false);
      setLogin('');
      setAvatar('');
      if (e.code !== 'github_not_connected' && e.code !== 'github_reconnect_required') {
        setError(e.message || 'تعذّر التحقق من ربط GitHub');
      } else if (e.code === 'github_reconnect_required') {
        clearGithubToken();
      }
      onConnectedChange?.(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);
  useEffect(() => { if (open) refresh(); }, [open]);

  const navigate = useNavigate();

  const handleConnect = async () => {
    setError('');
    setConnecting(true);
    try {
      const cfg = await getGithubConfig();
      const redirect_uri = window.location.origin + '/github/callback';
      const state = Math.random().toString(36).slice(2);
      sessionStorage.setItem('github_oauth_state', state);
      const url = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(cfg.client_id)}&scope=repo&redirect_uri=${encodeURIComponent(redirect_uri)}&state=${state}`;
      const popup = window.open(url, '_blank');
      if (!popup) { setError('اسمح بالنوافذ المنبثقة لإتمام الربط'); setConnecting(false); return; }
      const timer = setInterval(() => {
        if (popup.closed) { clearInterval(timer); setConnecting(false); refresh(); }
      }, 600);
    } catch (e) {
      setError(e.message || 'تعذّر بدء الربط');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await setGithubToken('');
    clearGithubToken();
    setConnected(false);
    setLogin('');
    setAvatar('');
    onConnectedChange?.(false);
    setResult(null);
  };

  const handlePush = async () => {
    setError('');
    setResult(null);
    if (!fileCount) { setError('لا يوجد كود لرفعه بعد'); return; }
    const token = getGithubToken();
    if (!token) { setError('اربط GitHub أولًا'); return; }
    setPushing(true);
    try {
      const data = await pushProjectToGithub({ files, repo, private: isPrivate, commitMessage: 'chore: push generated app', token });
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
            <Button onClick={() => navigate('/login')} className="w-full">تسجيل الدخول</Button>
          </div>
        ) : !connected ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">اربط حساب GitHub الخاص بك بضغطة زر — كل مستخدم يربط حسابه لوحده بكامل الصلاحيات (scope: repo).</p>
            <Button onClick={handleConnect} disabled={connecting} className="w-full">
              {connecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Github className="w-4 h-4 mr-2" />}
              {connecting ? 'جارٍ فتح GitHub…' : 'ربط حساب GitHub'}
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