import React, { useEffect, useState } from 'react';
import { Settings2, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { PROMPT_DEFS, getPrompt, setPrompt, resetPrompt, isOverridden } from '@/lib/systemPrompts';

export default function SystemPromptDialog() {
  const [open, setOpen] = useState(false);
  const [id, setId] = useState('agent');
  const [text, setText] = useState('');
  const [dirty, setDirty] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    setText(getPrompt(id));
    setDirty(false);
  }, [open, id]);

  const def = PROMPT_DEFS[id];
  const overridden = isOverridden(id);

  const handleSave = () => {
    setPrompt(id, text);
    setDirty(false);
    toast({ title: 'تم حفظ تعليمات النظام' });
  };

  const handleReset = () => {
    const d = resetPrompt(id);
    setText(d);
    setDirty(false);
    toast({ title: 'تمت استعادة التعليمات الافتراضية' });
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} title="تعديل تعليمات النظام">
        <Settings2 className="w-4 h-4" />
        <span className="hidden lg:inline mr-1">تعليمات النظام</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-4 h-4" /> تعليمات النظام للـ AI
            </DialogTitle>
            <DialogDescription>
              عدّل سلوك وكيل البناء مباشرة. التعديلات تُحفظ في متصفحك وتُطبّق فورًا على الجلسات القادمة.
              {overridden && <span className="text-amber-600 dark:text-amber-500"> · تم تخصيص هذه التعليمات</span>}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">القالب:</span>
            <select
              value={id}
              onChange={(e) => setId(e.target.value)}
              className="border rounded-md px-2 h-8 bg-background text-sm"
            >
              {Object.entries(PROMPT_DEFS).map(([k, v]) => (
                <option key={k} value={k}>{v.name}</option>
              ))}
            </select>
            {def?.description && <span className="text-muted-foreground">— {def.description}</span>}
          </div>

          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setDirty(true); }}
            spellCheck={false}
            className="flex-1 min-h-[300px] w-full rounded-md border bg-background p-3 font-mono text-xs leading-relaxed resize-none outline-none focus:ring-1 focus:ring-ring"
            placeholder="اكتب تعليمات النظام هنا…"
          />

          <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
            <Button variant="ghost" size="sm" onClick={handleReset} disabled={!overridden && !dirty}>
              <RotateCcw className="w-4 h-4 ml-1" /> استعادة الافتراضي
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>إغلاق</Button>
              <Button onClick={handleSave} disabled={!dirty}>
                <Save className="w-4 h-4 ml-1" /> حفظ
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}