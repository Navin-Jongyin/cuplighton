import { fetchPage } from "./pageRenderer.js";

function renderFallback() {
  const el = document.getElementById('content');
  el.innerHTML = '<p>Content not found. You may need to publish this page from the CMS.</p>';
}

async function init() {
  const slug = document.body.dataset.slug || 'home';
  try {
    const page = await fetchPage(slug);
    const el = document.getElementById('content');
    if (!page) return renderFallback();
    // page.contentHtml is assumed to be sanitized/stored from admin
    el.innerHTML = `<article><h2>${escapeHtml(page.title || '')}</h2>${page.contentHtml || ''}</article>`;
  } catch (err) {
    console.error('Failed to load page', err);
    renderFallback();
  }
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;