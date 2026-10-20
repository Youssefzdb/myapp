import React, { useState } from 'react';
import {
  FilePlus, FilePen, Trash2, FolderTree, FileSearch, CheckCircle2, Flag,
  Loader2, Check, X, ChevronLeft, Copy, CheckCheck, Code2, AlertTriangle,
  Image as ImageIcon, Search, Globe, Terminal, Database, ShieldCheck, Route, Eye,
} from 'lucide-react';
import { Image as UiImage } from '@/components/ui/image';

const ICONS = {
  write_file: FilePlus,
  edit_file: FilePen,
  delete_file: Trash2,
  list_files: FolderTree,
  read_file: FileSearch,
  check_project: CheckCircle2,
  inspect_backend: Database,
  validate_backend: ShieldCheck,
  list_routes: Route,
  search_files: Search,
  rename_file: FilePen,
  copy_file: Copy,
  format_json: Code2,
  project_stats: Database,
  finish: Flag,
  generate_image: ImageIcon,
  search_web: Search,
  fetch_website: Globe,
  curl: Terminal,
  skill_list: Code2,
  verify_preview: Eye,
};

const LABELS = {
  write_file: 'إنشاء ملف',
  edit_file: 'تعديل ملف',
  delete_file: 'حذف ملف',
  list_files: 'سرد الملفات',
  read_file: 'قراءة ملف',
  check_project: 'فحص المشروع',
  inspect_backend: 'فحص قاعدة البيانات',
  validate_backend: 'تحقق من الـ API',
  list_routes: 'سرد المسارات',
  search_files: 'البحث في الملفات',
  rename_file: 'إعادة تسمية ملف',
  copy_file: 'نسخ ملف',
  format_json: 'تنسيق JSON',
  project_stats: 'إحصائيات المشروع',
  finish: 'إنهاء',
  generate_image: 'توليد صورة',
  search_web: 'بحث ويب',
  fetch_website: 'جلب صفحة',
  curl: 'طلب HTTP (curl)',
  find_files: 'العثور على الملفات', read_many: 'قراءة ملفات متعددة', tree: 'شجرة الملفات', file_exists: 'التحقق من الملف', file_hash: 'بصمة الملف', count_tokens: 'عدّ الرموز',
  extract_exports: 'استخراج التصديرات', inspect_imports: 'فحص الاستيرادات', find_todos: 'العثور على المهام', detect_duplicates: 'كشف التكرار', validate_json: 'تحقق JSON', prettify_code: 'تنسيق الكود', diff_files: 'مقارنة الملفات', git_status: 'حالة مساحة العمل',
  create_dir: 'إنشاء مجلد', move_file: 'نقل ملف', replace_text: 'استبدال نص', append_file: 'إضافة إلى ملف', prepend_file: 'إضافة في بداية الملف', list_backend_collections: 'قوائم الـ Backend', inspect_env: 'فحص الإعدادات', test_api: 'اختبار API',
  preview_url: 'رابط المعاينة', screenshot_preview: 'لقطة المعاينة', accessibility_check: 'فحص الوصول', responsive_check: 'فحص التجاوب', analyze_bundle: 'تحليل الحزمة', dependency_list: 'قائمة التبعيات', package_info: 'معلومات الحزمة',
  generate_types: 'توليد الأنواع', create_manifest: 'إنشاء Manifest', export_project: 'تصدير المشروع', compress_project: 'ضغط المشروع', explain_error: 'شرح الخطأ', summarize_file: 'تلخيص الملف', ask_user: 'سؤال المستخدم',
  supabase_init: 'تهيئة Supabase', supabase_schema: 'مخطط Supabase', supabase_auth: 'مصادقة Supabase', supabase_validate: 'تحقق Supabase', supabase_upload: 'رفع Supabase',
};

const langOf = (path = '') => {
  const ext = path.split('.').pop();
  return ({ tsx: 'TSX', ts: 'TS', jsx: 'JSX', js: 'JS', css: 'CSS', json: 'JSON' }[ext] || 'TXT');
};

function CodeBlock({ code, maxH = 'max-h-64' }) {
  const [copied, setCopied] = useState(false);
  const lines = code.split('\n');
  const copy = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };
  return (
    <div className="relative">
      <button
        onClick={copy}
        className="absolute top-1.5 left-1.5 z-10 flex items-center gap-1 rounded-md bg-background/80 border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted"
        title="نسخ"
      >
        {copied ? <CheckCheck className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
        {copied ? 'نُسخ' : 'نسخ'}
      </button>
      <div dir="ltr" className={`overflow-auto ${maxH} bg-[hsl(220_13%_10%)] text-[hsl(0_0_90%)] rounded-md border border-border/60 text-[11px] font-mono leading-relaxed`}>
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((ln, i) => (
              <tr key={i} className="hover:bg-white/5">
                <td className="select-none text-right pr-2 pl-3 text-muted-foreground/50 w-10 border-r border-white/10 align-top">{i + 1}</td>
                <td className="pl-2 pr-2 whitespace-pre">{ln || ' '}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DiffView({ body }) {
  const blocks = [...body.matchAll(/<{5,}\s*SEARCH\n([\s\S]*?)\n={5,}\n([\s\S]*?)\n?>{5,}\s*REPLACE/g)];
  if (!blocks.length) return <CodeBlock code={body} />;
  return (
    <div dir="ltr" className="space-y-2 overflow-auto max-h-80 bg-[hsl(220_13%_10%)] rounded-md border border-border/60 text-[11px] font-mono leading-relaxed">
      {blocks.map((b, i) => {
        const searchLines = (b[1] ?? '').split('\n');
        const replaceLines = (b[2] ?? '').split('\n');
        return (
          <div key={i}>
            {searchLines.map((ln, j) => (
              <div key={`s${j}`} className="px-2 bg-red-500/15 text-red-300 whitespace-pre">
                <span className="select-none opacity-50">- </span>{ln || ' '}
              </div>
            ))}
            {replaceLines.map((ln, j) => (
              <div key={`r${j}`} className="px-2 bg-green-500/15 text-green-300 whitespace-pre">
                <span className="select-none opacity-50">+ </span>{ln || ' '}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function FileList({ output }) {
  const rows = output.split('\n').filter(Boolean);
  return (
    <div className="text-[11px] font-mono space-y-0.5">
      {rows.map((r, i) => {
        const m = r.match(/^(.*)\s\((\d+)\s+lines\)$/);
        const path = m ? m[1] : r;
        const lines = m ? m[2] : '';
        return (
          <div key={i} className="flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-muted/50" dir="ltr">
            <Code2 className="w-3 h-3 text-muted-foreground shrink-0" />
            <span className="truncate">{path}</span>
            {lines && <span className="text-muted-foreground/60 shrink-0">{lines} س</span>}
          </div>
        );
      })}
    </div>
  );
}

function Problems({ output }) {
  const ok = /no problems found|OK/i.test(output);
  const rows = output.split('\n').filter(Boolean);
  return (
    <div className="space-y-1">
      {ok ? (
        <div className="flex items-center gap-1.5 text-green-600 text-xs px-1.5">
          <Check className="w-3.5 h-3.5" /> لا توجد مشاكل
        </div>
      ) : (
        rows.map((r, i) => (
          <div key={i} className="flex items-start gap-1.5 text-destructive text-[11px] px-1.5 py-0.5 bg-destructive/5 rounded">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span className="font-mono break-all" dir="ltr">{r}</span>
          </div>
        ))
      )}
    </div>
  );
}

export default function ToolCalls({ tools }) {
  const [openId, setOpenId] = useState(null);
  if (!tools || !tools.length) return null;

  return (
    <div className="mt-2.5 space-y-1.5" dir="rtl">
      {tools.map((t) => {
        const Icon = ICONS[t.name] ?? FilePlus;
        const label = LABELS[t.name] ?? t.name;
        const path = t.args?.path;
        const running = t.status === 'running';
        const done = t.status === 'done';
        const err = t.status === 'error';
        const live = t.live;
        const content = t.content ?? (live && live.trim() ? live : null);
        const isCode = (t.name === 'write_file' || t.name === 'read_file') && content;
        const isDiff = t.name === 'edit_file' && content;
        const isList = t.name === 'list_files' && t.output;
        const isCheck = t.name === 'check_project' && t.output;
        const isFinish = t.name === 'finish';
        const isImage = t.name === 'generate_image';
        const arg = t.args?.prompt || t.args?.query || t.args?.url;
        const imgUrl = isImage ? (t.url || (t.output && (t.output.match(/https?:\/\/\S+/)?.[0] || '')) || '') : '';
        const hasBody = isCode || isDiff || isList || isCheck || isImage || (t.output && t.name !== 'write_file' && t.name !== 'edit_file' && t.name !== 'list_files' && t.name !== 'check_project' && t.name !== 'finish');
        const isOpen = openId === t.id;
        const lineCount = content ? content.split('\n').length : null;

        return (
          <div key={t.id} className={`rounded-lg border bg-background/60 text-xs overflow-hidden ${err ? 'border-destructive/40' : ''}`}>
            <button
              onClick={() => (hasBody || isFinish) && setOpenId((o) => (o === t.id ? null : t.id))}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-right ${(hasBody || isFinish) ? 'hover:bg-muted/50 cursor-pointer' : 'cursor-default'}`}
            >
              <span className={`shrink-0 ${err ? 'text-destructive' : done ? 'text-green-500' : 'text-primary'}`}>
                {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : err ? <X className="w-3.5 h-3.5" /> : done ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
              </span>
              <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="font-medium shrink-0">{label}</span>
              {path && (
                <span className="text-muted-foreground truncate font-mono text-[11px] flex items-center gap-1" dir="ltr">
                  <span className="px-1 py-px rounded bg-muted text-[9px] font-bold tracking-wide">{langOf(path)}</span>
                  {path}
                </span>
              )}
              {arg && (
                <span className="text-muted-foreground truncate text-[11px]" dir="auto">{arg}</span>
              )}
              {lineCount != null && <span className="text-[10px] text-muted-foreground/70 shrink-0">{lineCount} سطر</span>}
              {t.durationMs != null && done && (
                <span className="text-[10px] text-muted-foreground/70 shrink-0 mr-auto">{(t.durationMs / 1000).toFixed(1)}ث</span>
              )}
              {(hasBody || isFinish) && <ChevronLeft className={`w-3 h-3 text-muted-foreground shrink-0 transition-transform ${isOpen ? '-rotate-90' : ''} ${t.durationMs != null ? '' : 'mr-auto'}`} />}
            </button>
            {isOpen && (
              <div className="px-2 pb-2 pt-1 border-t bg-muted/20">
                {live && !done && <div className="text-[10px] text-muted-foreground mb-1">يُولّد الآن…</div>}
                {isCode && <CodeBlock code={content} />}
                {isDiff && <DiffView body={content} />}
                {isList && <FileList output={t.output} />}
                {isCheck && <Problems output={t.output} />}
                {isImage && imgUrl && (
                  <div className="space-y-1.5">
                    <UiImage src={imgUrl} alt={t.args?.prompt || 'generated'} className="w-full rounded-md border max-h-56" fittingType="fit" />
                    {t.args?.prompt && <div className="text-[10px] text-muted-foreground" dir="auto">{t.args.prompt}</div>}
                  </div>
                )}
                {hasBody && !isCode && !isDiff && !isList && !isCheck && !isImage && (
                  <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap break-words leading-relaxed font-mono" dir="ltr">{t.output}</pre>
                )}
                {isFinish && (
                  <div className="text-[11px] text-foreground/80 leading-relaxed">{t.output}</div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
