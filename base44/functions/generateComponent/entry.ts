import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const MODEL_MAP = {
  'beam-free': 'automatic',
  'gpt-4o-mini': 'gpt_6_luna',
  'claude-3.5-sonnet': 'claude-sonnet-5'
};

const SYSTEM = `أنت مساعد توليد مكوّنات React و Tailwind CSS بأسلوب v0 و Lovable.
المستخدم يصف ما يريد بناءه، وعليك توليد مكوّن React واحد قابل للمعاينة الحية.

قواعد إخراج الكود (إلزامية):
- عرّف دالة top-level باسم App: function App() { return (...) }
- لا تستخدم import ولا export إطلاقاً.
- استخدم أنماط Tailwind CSS فقط (تُحمّل عبر Tailwind CDN داخل المعاينة).
- للأيقونات استخدم SVG مضمّن (inline <svg>) ولا تستخدم lucide-react.
- إذا احتجت حالة استخدم React.useState (لا useState مباشرة).
- الكود يجب أن يكون مكتفٍ ذاتياً ويعمل فوراً بدون أي تثبيت.
- اجعل التصميم نظيفاً واحترافياً ومتجاوباً.

المخرجات: JSON يحتوي على:
- reasoning: شرح خطوات تفكيرك بالعربية.
- toolCalls: مصفوفة خطوات مثل {name:"create_file", detail:"ComponentName.jsx"} و {name:"install_dependencies", detail:"tailwindcss"}.
- code: الكود الكامل للمكوّن فقط (بدون شرح إضافي خارج الكود).`;

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const prompt = (body?.prompt || '').toString().trim();
    if (!prompt) return Response.json({ error: 'prompt required' }, { status: 400 });

    const model = MODEL_MAP[body?.model] || 'automatic';
    const history = Array.isArray(body?.history) ? body.history : [];

    const convo = history
      .map((m) => `${m.role === 'user' ? 'المستخدم' : 'المساعد'}: ${m.content || ''}`)
      .join('\n');

    const userPrompt =
      (convo ? `سياق المحادثة السابقة:\n${convo}\n\n` : '') +
      `الطلب الحالي: ${prompt}\n\nولّد مكوّن React/Tailwind يحقق هذا الطلب بدقة.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: SYSTEM + '\n\n' + userPrompt,
      model,
      response_json_schema: {
        type: 'object',
        properties: {
          reasoning: { type: 'string' },
          toolCalls: {
            type: 'array',
            items: {
              type: 'object',
              properties: { name: { type: 'string' }, detail: { type: 'string' } },
              required: ['name', 'detail']
            }
          },
          code: { type: 'string' }
        },
        required: ['reasoning', 'code']
      }
    });

    return Response.json({
      reasoning: result.reasoning || '',
      toolCalls: Array.isArray(result.toolCalls) ? result.toolCalls : [],
      code: result.code || ''
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}