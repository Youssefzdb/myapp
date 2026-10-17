import React, { useState, useEffect } from 'react';
import { Github, Loader2, UploadCloud, Unlink, CheckCircle2, ExternalLink, KeyRound } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useNavigate } from 'react-router-dom';
import { checkGithub, pushProjectToGithub } from '@/lib/github';
import { getSession, getGithubToken, setGithubToken, clearGithubToken } from '@/lib/customAuth';

export default function GithubDialog({ files, autoPush, onAutoPushChange, onConnectedChange }) {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [connected, setConnected] = useState(false);
  const [login, setLogin] = useState('');
  const [avatar, setAvatar] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [repo, setRepo] = useState('vibe-app');
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
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
      if (e.code !== 'github_not_connected') {
        setError(e.message || 'تعذّر التحقق من ربط GitHub');
      }
      onConnectedChange?.(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  const navigate = useNavigate();

  const handleSaveToken = async () => {
    setError('');
    const token = tokenInput.trim();
    if (!token) { setError('الصق رمز PAT أولًا'); return; }
    setVerifying(true);
    try {
      const data = await checkGithub(token);
      await setGithubToken(token);
      setConnected(true);
      setLogin(data.login);
      setAvatar(data.avatar || '');
      setTokenInput('');
      onConnectedChange?.(true);
    } catch (e) {
      setError(e.message || 'رمز غير صالح');
    } finally {
      setVerifying(false);
    }
  };

  const handleDisconnect = () => {
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
            <p className="text-sm text-muted-foreground">
              أنشئ رمز وصول شخصي (PAT) من GitHub بصلاحيات <span className="font-mono">repo</span> والصقه هنا. كل مستخدم يربط حسابه الخاص بكامل الصلاحيات.
            </p>
            <a href="https://github.com/settings/tokens/new?scopes=repo,read:user&description=Vibe%20Studio" target="_blank" rel="noreferrer" className="text-xs text-primary underline inline-flex items-center gap-1">
              <ExternalLink className="w-3.5 h-3.5" /> إنشاء رمز PAT على GitHub
            </a>
            <div className="space-y-1.5">
              <Label className="text-xs">رمز PAT</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <KeyRound className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} placeholder="ghp_..." className="pr-8 font-mono text-xs" type="password" />
                </div>
                <Button onClick={handleSaveToken} disabled={verifying}>
                  {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'ربط'}
                </Button>
              </div>
            </div>
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