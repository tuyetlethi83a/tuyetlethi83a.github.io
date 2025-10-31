// /assets/mxd-affiliate.js
document.addEventListener('DOMContentLoaded', () => {
  // BASES theo tuyetlethi83a (đã xác nhận)
  const BASES = {
    shopee: "https://go.isclix.com/deep_link/6837055118319564314/4751584435713464237",
    tiktok: "https://go.isclix.com/deep_link/6837055118319564314/6648523843406889655",
    lazada: "https://go.isclix.com/deep_link/6837055118319564314/5369219770778085421"
  };

  const isIsclix = (u) => {
    try { return new URL(u).hostname.endsWith('isclix.com'); } catch { return false; }
  };

  const buildDeepLink = (base, origin, meta) => {
    if (!base) return origin;
    // Giữ nguyên nếu origin đã là isclix
    if (isIsclix(origin)) return origin;

    // Chuẩn hoá absolute URL cho origin (kể cả khi meta dùng đường dẫn tương đối)
    try { origin = new URL(origin, location.origin).href; } catch { /* noop */ }

    const glue = base.includes('?') ? '&' : '?';
    let url = `${base}${glue}url=${encodeURIComponent(origin)}`;

    // Optional: sub1..sub4 (nếu cần, set data-sub1..data-sub4 trên a.product-meta)
    ['sub1','sub2','sub3','sub4'].forEach(k => {
      const v = meta?.dataset?.[k];
      if (v) url += `&${k}=${encodeURIComponent(v)}`;
    });

    return url;
  };

  const sendGA = (merchant, sku, price) => {
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'aff_click', {
        event_category: 'affiliate',
        event_label: merchant || '',
        value: Number(price) || undefined,
        merchant, sku
      });
    }
  };

  document.querySelectorAll('.product-card').forEach(card => {
    const meta = card.querySelector('a.product-meta');
    if (!meta) return;

    const origin = meta.getAttribute('href') || '#';
    const merchant = (meta.dataset.merchant || '').toLowerCase();
    const base = BASES[merchant];

    const finalUrl = buildDeepLink(base, origin, meta);

    card.querySelectorAll('a.buy').forEach(a => {
      // Giữ nguyên nếu buộc giữ link gốc
      if (a.dataset.origin === 'keep') return;
      a.href = finalUrl;
      a.rel = 'nofollow noopener noreferrer';
      // Gửi GA4 khi click
      a.addEventListener('click', () => sendGA(merchant, meta.dataset.sku, meta.dataset.price));
    });
  });
});
