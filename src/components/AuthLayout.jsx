import React from "react";
import { Sparkles, Zap, Code2, Github } from "lucide-react";

const FEATURES = [
  { icon: Zap, text: "ولّد تطبيقات React كاملة في ثوانٍ" },
  { icon: Code2, text: "حرّر ومعاينة الكود مباشرة" },
  { icon: Github, text: "ارفع مشروعك إلى GitHub بنقرة" },
];

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div dir="rtl" className="min-h-screen flex bg-background">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-[46%] relative overflow-hidden bg-gradient-to-br from-primary to-foreground p-12 flex-col justify-between text-primary-foreground">
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute bottom-10 left-10 w-64 h-64 rounded-full bg-white/5 blur-2xl" />

        <div className="relative flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-primary-foreground/15 backdrop-blur flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="text-lg font-semibold">Vibe Studio</span>
        </div>

        <div className="relative space-y-7">
          <h2 className="text-4xl font-bold leading-tight">
            حوّل فكرتك<br />إلى تطبيق حقيقي
          </h2>
          <p className="text-primary-foreground/70 text-lg leading-relaxed max-w-sm">
            استوديو ذكاء اصطناعي يبني تطبيقات React متعددة الملفات جاهزة للنشر — فقط اصف ما تريد.
          </p>
          <ul className="space-y-3.5">
            {FEATURES.map((f) => (
              <li key={f.text} className="flex items-center gap-3 text-primary-foreground/90">
                <span className="w-9 h-9 rounded-lg bg-primary-foreground/10 backdrop-blur flex items-center justify-center shrink-0">
                  <f.icon className="w-4.5 h-4.5" />
                </span>
                <span className="text-sm">{f.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-primary-foreground/50">© {new Date().getFullYear()} Vibe Studio · Opencode Free</p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="text-lg font-semibold">Vibe Studio</span>
          </div>

          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4">
              <Icon className="w-7 h-7 text-primary-foreground" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
            {subtitle && <p className="text-muted-foreground mt-2 text-sm">{subtitle}</p>}
          </div>

          <div className="bg-card rounded-2xl shadow-sm border border-border p-6 sm:p-8">
            {children}
          </div>

          {footer && (
            <p className="text-center text-sm text-muted-foreground mt-6">{footer}</p>
          )}
        </div>
      </div>
    </div>
  );
}