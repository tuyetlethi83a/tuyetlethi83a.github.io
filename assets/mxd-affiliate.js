// /assets/mxd-affiliate.js
(() => {
  // BASES của tuyetlethi83a (đã xác nhận)
  const BASES = {
    shopee: "https://go.isclix.com/deep_link/6837055118319564314/4751584435713464237",
    tiktok: "https://go.isclix.com/deep_link/6837055118319564314/6648523843406889655",
    lazada: "https://go.isclix.com/deep_link/6837055118319564314/5369219770778085421",
  };

  const isIsclix = (u) => {
    try { return new URL(u).hostname.endsWith('isclix.com'); } catch { return false; }
  };

  const deepLinkFor = (meta) => {
    let origin = meta.getAttribute('href') || '#';
    const merchant = (meta.dataset.merchant || '').toLowerCase();
    const base = BASES[merchant];

    // Chuẩn hoá absolute
    try { origin = new URL(origin, location.origin).href; } catch {}

    // Nếu đã là isclix hoặc không có base → giữ nguyên
    if (!base || isIsclix(origin)) return origin;

    const glue = base.includes('?') ? '&' : '?';
    let url = `${base}${glue}url=${encodeURIComponent(origin)}`;

    // Optional sub1..sub4
    ['sub1','sub2','sub3','sub4'].forEach(k => {
      const v = meta.dataset[k];
      if (v) url += `&${k}=${encodeURIComponent(v)}`;
    });

    return url;
  };

  const sendGA = (meta) => {
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'aff_click', {
        event_category: 'affiliate',
        event_label: meta.dataset.merchant || '',
        value: Number(meta.dataset.price) || undefined,
        merchant: meta.dataset.merchant || '',
        sku: meta.dataset.sku || ''
      });
    }
  };

  const rewriteCard = (card) => {
    const meta = card.querySelector('a.product-meta');
    if (!meta) return;
    const finalUrl = deepLinkFor(meta);
    card.querySelectorAll('a.buy').forEach(a => {
      if (a.dataset.origin === 'keep') return;
      a.href = finalUrl; // để user có thể copy link
      a.rel = 'nofollow noopener noreferrer';
    });
  };

  const rewriteAll = () =>
    document.querySelectorAll('.product-card').forEach(rewriteCard);

  document.addEventListener('DOMContentLoaded', () => {
    // 1) Rewrite lần đầu
    rewriteAll();

    // 2) Uỷ quyền click: luôn điều hướng dù href đang là "#"
    document.addEventListener('click', (ev) => {
      const btn = ev.target.closest('a.buy');
      if (!btn) return;
      if (btn.dataset.origin === 'keep') return;

      const card = btn.closest('.product-card');
      const meta = card && card.querySelector('a.product-meta');
      if (!meta) return;

      const finalUrl = deepLinkFor(meta);
      btn.href = finalUrl; // cập nhật thực tế
      sendGA(meta);

      ev.preventDefault();           // chặn "#" giữ nguyên trang
      window.location.assign(finalUrl); // điều hướng chắc chắn
    });

    // 3) Theo dõi DOM để xử lý các card thêm sau fetch
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        m.addedNodes && m.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches?.('.product-card')) rewriteCard(node);
          node.querySelectorAll?.('.product-card').forEach(rewriteCard);
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  });
})();
