// Painel modal genérico. Botões com data-a="nome" chamam on[nome](elemento).
const panel = document.getElementById('panel');
const pTitle = document.getElementById('pTitle'), pBody = document.getElementById('pBody'), pFoot = document.getElementById('pFoot');
let handlers = {}, onClose = null;
export function openPanel({ title, body, foot = '', on = {}, close }) {
  pTitle.innerHTML = title; pBody.innerHTML = body; pFoot.innerHTML = foot;
  pFoot.style.display = foot ? 'flex' : 'none';
  handlers = on; onClose = close || null;
  panel.classList.remove('hidden');
}
export function setBody(html) { const st = pBody.scrollTop; pBody.innerHTML = html; pBody.scrollTop = st; }
export function setFoot(html) { pFoot.innerHTML = html; pFoot.style.display = html ? 'flex' : 'none'; }
export function closePanel() { panel.classList.add('hidden'); const f = onClose; onClose = null; handlers = {}; if (f) f(); }
export function isOpen() { return !panel.classList.contains('hidden'); }
document.getElementById('pClose').addEventListener('click', () => { if (handlers.fechar) handlers.fechar(); else closePanel(); });
panel.addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
  const fn = handlers[b.dataset.a]; if (fn) fn(b);
});
panel.addEventListener('change', e => {
  const b = e.target.closest('[data-c]'); if (!b) return;
  const fn = handlers[b.dataset.c]; if (fn) fn(b);
});
