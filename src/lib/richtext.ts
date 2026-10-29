// Admin texts are plain text with a few inline tags: <strong>/<b>, <em>/<i>, <a href="…"> and <br>.
// Any other tag is shown as typed. Enter gives a line break, an empty line starts a new paragraph.

const TOKEN = /<(\/?)(strong|b|em|i)\s*>|<br\s*\/?>|<a\s[^>]*?href\s*=\s*(["'])(.*?)\3[^>]*>|<\/a\s*>/gi;

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Safe link target: http(s), mailto, tel, site paths and anchors; "irievibes.be/x" gets https://. */
function safeHref(raw: string): string | undefined {
  const href = raw.trim().replace(/&amp;/g, '&');
  if (/^(https?:|mailto:|tel:)/i.test(href) || /^[/#?]/.test(href)) return href;
  if (/^(www\.)?[\w-]+(\.[\w-]+)+(\/|$)/i.test(href)) return `https://${href}`;
  return undefined;
}

/** One paragraph (or heading) of admin text as HTML: allowed tags kept, Enter → <br>. */
export function inlineHtml(text: string | null | undefined): string {
  const source = (text ?? '').trim();
  const open: string[] = [];
  let html = '';
  let last = 0;
  for (const match of source.matchAll(TOKEN)) {
    html += escapeHtml(source.slice(last, match.index)).replace(/\r?\n/g, '<br>');
    last = match.index + match[0].length;
    const [token, closing, tag, , href] = match;
    const lower = token.toLowerCase();
    if (lower.startsWith('<br')) html += '<br>';
    else if (tag) {
      const name = tag.toLowerCase() === 'b' ? 'strong' : tag.toLowerCase() === 'i' ? 'em' : tag.toLowerCase();
      if (!closing) {
        open.push(name);
        html += `<${name}>`;
      } else if (open.includes(name)) {
        while (open.length) {
          const top = open.pop()!;
          html += `</${top}>`;
          if (top === name) break;
        }
      }
    } else if (lower.startsWith('<a')) {
      const target = safeHref(href ?? '');
      if (!target || open.includes('a')) continue;
      open.push('a');
      const external = /^https?:/i.test(target);
      html += `<a href="${escapeHtml(target)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>`;
    } else if (open.includes('a')) {
      while (open.length) {
        const top = open.pop()!;
        html += `</${top}>`;
        if (top === 'a') break;
      }
    }
  }
  html += escapeHtml(source.slice(last)).replace(/\r?\n/g, '<br>');
  // Close what the editor left open, so nothing leaks into the next paragraph.
  while (open.length) html += `</${open.pop()}>`;
  return html;
}

/** Admin text split into paragraphs (on empty lines), each as HTML; empty text gives none. */
export function paragraphsHtml(text: string | null | undefined): string[] {
  return (text ?? '')
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => inlineHtml(paragraph))
    .filter(Boolean);
}
