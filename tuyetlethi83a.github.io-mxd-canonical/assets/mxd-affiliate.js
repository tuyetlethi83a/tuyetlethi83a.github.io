document.addEventListener('DOMContentLoaded',()=>{
  const BASES = {"shopee": "https://go.isclix.com/deep_link/6837055118319564314/4751584435713464237", "tiktok": "https://go.isclix.com/deep_link/6837055118319564314/6648523843406889655", "lazada": "https://go.isclix.com/deep_link/6837055118319564314/5369219770778085421"};
  document.querySelectorAll('.product-card').forEach(card=>{
    const meta = card.querySelector('a.product-meta');
    if(!meta) return;
    const origin = meta.getAttribute('href');
    const merchant = (meta.dataset.merchant||'').toLowerCase();
    const base = BASES[merchant];
    const finalUrl = base ? base + '?url=' + encodeURIComponent(origin) : origin;
    card.querySelectorAll('a.buy').forEach(a=>{
      if(a.dataset.origin==='keep') return;
      a.href = finalUrl;
      a.rel = 'nofollow noopener noreferrer';
    });
  });
});