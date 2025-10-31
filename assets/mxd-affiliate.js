// REPLACE WHOLE FILE: /assets/mxd-affiliate.js
(() => {
  const BASES = {
    shopee: "https://go.isclix.com/deep_link/6837055118319564314/4751584435713464237",
    tiktok:  "https://go.isclix.com/deep_link/6837055118319564314/6648523843406889655",
    lazada:  "https://go.isclix.com/deep_link/6837055118319564314/5369219770778085421",
  };
  const isIsclix = (u)=>{ try{ return new URL(u).hostname.endsWith('isclix.com'); }catch{ return false; } };
  const deepLinkFor = (meta)=>{
    let origin = meta.getAttribute('href') || '#';
    try{ origin = new URL(origin, location.origin).href; }catch{}
    const base = BASES[(meta.dataset.merchant||'').toLowerCase()];
    if(!base||isIsclix(origin)) return origin;
    const glue = base.includes('?') ? '&' : '?';
    let url = `${base}${glue}url=${encodeURIComponent(origin)}`;
    ['sub1','sub2','sub3','sub4'].forEach(k=>{ const v=meta.dataset[k]; if(v) url+=`&${k}=${encodeURIComponent(v)}`; });
    return url;
  };
  const sendGA = (meta)=>{
    if(typeof window.gtag==='function'){
      window.gtag('event','aff_click',{event_category:'affiliate',event_label:meta.dataset.merchant||'',value:Number(meta.dataset.price)||undefined,merchant:meta.dataset.merchant||'',sku:meta.dataset.sku||''});
    }
  };
  const rewriteCard = (card)=>{
    const meta = card.querySelector('a.product-meta'); if(!meta) return;
    const finalUrl = deepLinkFor(meta);
    card.querySelectorAll('a.buy').forEach(a=>{ if(a.dataset.origin==='keep') return;
      a.href = finalUrl; a.rel='nofollow noopener noreferrer';
    });
  };
  const rewriteAll = ()=> document.querySelectorAll('.product-card').forEach(rewriteCard);

  document.addEventListener('DOMContentLoaded', ()=>{
    rewriteAll();
    document.addEventListener('click',(ev)=>{
      const btn = ev.target.closest('a.buy'); if(!btn||btn.dataset.origin==='keep') return;
      const card = btn.closest('.product-card'); const meta = card && card.querySelector('a.product-meta'); if(!meta) return;
      const finalUrl = deepLinkFor(meta); btn.href = finalUrl; sendGA(meta); ev.preventDefault(); window.location.assign(finalUrl);
    });
    new MutationObserver(muts=>{
      muts.forEach(m=>m.addedNodes&&m.addedNodes.forEach(node=>{
        if(!(node instanceof Element)) return;
        if(node.matches?.('.product-card')) rewriteCard(node);
        node.querySelectorAll?.('.product-card').forEach(rewriteCard);
      }));
    }).observe(document.body,{childList:true,subtree:true});
  });
})();
