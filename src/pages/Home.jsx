import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, Zap, Code2, Rocket, ArrowLeft, FolderOpen, Plus, LogIn, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSession, getProjects } from '@/lib/customAuth';

const FEATURES = [
  { icon: Zap, title: 'بناء فوري', desc: 'ولّد تطبيقات React متعددة الملفات في ثوانٍ.' },
  { icon: Code2, title: 'تحرير مباشر', desc: 'حرّر الكود وعاينه لحظيًا في المتصفح.' },
  { icon: Rocket, title: 'نشر بضغطة', desc: 'انشر تطبيقك عامًا أو خاصًا وارفعه إلى GitHub.' },
];

const formatDate = (iso) => {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ar', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return ''; }
};

export default function Home() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    const s = getSession();
    setSession(s);
    if (s) setProjects(getProjects());
  }, []);

  const openProject = (p) => {
    sessionStorage.setItem('vibe_load_project', JSON.stringify({ title: p.title, code_uri: p.code_uri }));
    navigate('/playground');
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-20 backdrop-blur bg-background/80 border-b">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold">Vibe Studio</span>
          </Link>
          <div className="flex items-center gap-2">
            {session ? (
              <Button asChild size="sm">
                <Link to="/playground"><Plus className="w-4 h-4 ml-1" />مشروع جديد</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm"><Link to="/login">دخول</Link></Button>
                <Button asChild size="sm"><Link to="/register">إنشاء حساب</Link></Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-bl from-primary/10 via-transparent to-primary/5" />
        <div className="absolute -top-24 right-0 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative max-w-6xl mx-auto px-4 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3.5 py-1.5 text-xs text-muted-foreground mb-6">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            استوديو ذكاء اصطناعي لبناء التطبيقات
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[1.1]">
            حوّل فكرتك إلى <br className="hidden sm:block" />
            <span className="bg-gradient-to-l from-primary to-foreground bg-clip-text text-transparent">تطبيق حقيقي</span>
          </h1>
          <p className="mt-5 text-muted-foreground text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
            اصف التطبيق الذي تريد، وسيبنيه لك الـ AI مع معاينة حية — جاهز للنشر والرفع إلى GitHub.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button asChild size="lg" className="rounded-full h-12 px-7 text-base">
              <Link to="/playground">ابدأ البناء مجانًا <ArrowLeft className="w-4 h-4 mr-1" /></Link>
            </Button>
            {!session && (
              <Button asChild size="lg" variant="outline" className="rounded-full h-12 px-7 text-base">
                <Link to="/register"><LogIn className="w-4 h-4 ml-1" />أنشئ حسابك</Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-14">
        <div className="grid sm:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-6 hover:shadow-md transition-shadow">
              <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-base mb-1.5">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* My Projects */}
      <section className="max-w-6xl mx-auto px-4 pb-20">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-primary" /> مشاريعي
          </h2>
          {session && (
            <Button asChild variant="outline" size="sm"><Link to="/playground"><Plus className="w-4 h-4 ml-1" />جديد</Link></Button>
          )}
        </div>

        {!session ? (
          <div className="rounded-2xl border bg-card p-10 text-center">
            <p className="text-muted-foreground text-sm mb-4">سجّل الدخول لعرض مشاريعك المحفوظة وإنشاء مشاريع جديدة خاصة بك.</p>
            <Button asChild><Link to="/login">تسجيل الدخول</Link></Button>
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card p-10 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <Code2 className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mb-4">لا توجد مشاريع بعد. ابدأ أول مشروع لك الآن.</p>
            <Button asChild><Link to="/playground"><Plus className="w-4 h-4 ml-1" />إنشاء مشروع</Link></Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <button key={p.id} onClick={() => openProject(p)} className="text-right rounded-2xl border bg-card p-5 hover:shadow-md hover:border-primary/40 transition-all group">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Code2 className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />{formatDate(p.created_date)}
                  </span>
                </div>
                <h3 className="font-medium text-sm line-clamp-2 mb-1.5 group-hover:text-primary transition-colors">{p.title}</h3>
                {p.prompt && <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{p.prompt}</p>}
                <span className="mt-3 inline-flex items-center gap-1 text-xs text-primary">فتح <ArrowLeft className="w-3 h-3" /></span>
              </button>
            ))}
          </div>
        )}
      </section>

      <footer className="border-t">
        <div className="max-w-6xl mx-auto px-4 py-6 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Vibe Studio</span>
          <span>© {new Date().getFullYear()} · Opencode Free</span>
        </div>
      </footer>
    </div>
  );
}