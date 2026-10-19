export function parseSupercoolChat(text, contentType) {
  const messages = contentType.includes('text/event-stream')
    ? text.split(/\r?\n\r?\n/).map((block) => block.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n')).filter((value) => value && value !== '[DONE]').map((value) => JSON.parse(value))
    : [JSON.parse(text)];
  const response = messages.find((message) => message.error || message.result);
  if (!response) throw new Error('وصل رد من خدمة الدردشة لكنه لا يحتوي على نتيجة.');
  if (response.error) throw new Error(response.error.message || JSON.stringify(response.error));
  const result = response.result;
  const content = (result.content || []).filter((item) => item.type === 'text').map((item) => item.text).join('\n');
  if (result.isError) throw new Error(content || 'رفضت خدمة الدردشة الطلب.');
  return { data: response, reply: result.structuredContent?.supercool?.reply || content, raw: text };
}

export function supercoolError(error, settings) {
  if (error instanceof TypeError && /fetch|network|load failed/i.test(error.message)) {
    const route = settings.useProxy ? `الـ Worker: ${settings.proxy}` : 'الاتصال المباشر (البروكسي معطّل)';
    return `تعذّر الوصول عبر ${route}. افتح إعدادات الاتصال وتأكد من تفعيل البروكسي وصحة رابطه. لم يصل رد من الخدمة بعد.`;
  }
  return error.message || String(error);
}