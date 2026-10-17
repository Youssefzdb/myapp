import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { exchangeGithubCode } from '@/lib/github';
import { getSession, setGithubToken } from '@/lib/customAuth';

export default function GithubCallback() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState('loading');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      const code = params.get('code');
      if (!code) { setStatus('error'); setMsg('لم يصل رمز التفويض من GitHub'); return; }
      const session = getSession();
      if (!session) { setStatus('error'); setMsg('سجّل الدخول أولًا في النافذة الرئيسية'); return; }
      const redirect_uri = window.location.origin + '/github/callback';
      try {
        const data = await exchangeGithubCode(code, redirect_uri);
        if (data?.error) throw new Error(data.error);
        await setGithubToken(data.access_token);
        setStatus('ok');
        setMsg('تم ربط GitHub بنجاح');
        setTimeout(() => { try { window.close(); } catch {} }, 1200);
      } catch (e) {
        setStatus('error');
        setMsg(e.message || 'فشل الربط');
      }
    })();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
      {status === 'loading' && (
        <>
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">جارٍ ربط GitHub…</p>
        </>
      )}
      {status === 'ok' && (
        <>
          <CheckCircle2 className="w-8 h-8 text-green-500" />
          <p className="text-sm font-medium">{msg}</p>
          <p className="text-xs text-muted-foreground">يمكنك إغلاق هذه النافذة</p>
        </>
      )}
      {status === 'error' && (
        <>
          <XCircle className="w-8 h-8 text-destructive" />
          <p className="text-sm text-destructive">{msg}</p>
        </>
      )}
    </div>
  );
}