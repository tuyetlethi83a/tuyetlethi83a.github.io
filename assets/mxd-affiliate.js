// REPLACE WHOLE FILE: /assets/mxd-affiliate.js
(() => {
  // FIND: BASES / merchant inference / default subs
  const BASES = {
    shopee: "https://go.isclix.com/deep_link/6837055118319564314/4751584435713464237",
    tiktok: "https://go.isclix.com/deep_link/6837055118319564314/6648523843406889655",
    lazada: "https://go.isclix.com/deep_link/6837055118319564314/5369219770778085421",
  };

  const MERCHANT_FROM_HOST = (h) => {
    if (!h) return "";
    const host = h.toLowerCase();
    if (host.includes("shopee")) return "shopee";
    if (host.includes("lazada")) return "lazada";
    if (host.includes("tiktok")) return "tiktok";
    return "";
  };

  const isIsclix = (u) => {
    try { return new URL(u).hostname.endsWith("isclix.com"); } catch { return false; }
  };

  const absUrl = (href) => {
    try { return new URL(href, location.origin).href; } catch { return href || "#"; }
  };

  const pickMerchant = (meta, originAbs) => {
    const fromData = (meta.dataset.merchant || "").toLowerCase();
    if (fromData) return fromData;
    try { return MERCHANT_FROM_HOST(new URL(originAbs).hostname); } catch { return ""; }
  };

  const guessSku = (meta, card) => {
    if (meta.dataset.sku) return meta.dataset.sku;
    if (card?.dataset?.sku) return card.dataset.sku;
    const img = card?.querySelector?.('img[src*="/assets/img/products/"]');
    if (img) {
      const m = img.src.match(/\/assets\/img\/products\/([^\/]+)\.webp/i);
      if (m) return m[1];
    }
    // last resort: last path segment (may be noisy)
    try {
      const u = new URL(meta.getAttribute("href") || "#", location.origin);
      const segs = (u.pathname || "").split("/").filter(Boolean);
      return segs.pop() || "";
    } catch { return ""; }
  };

  const buildSubs = (meta, card, merchant) => {
    // Defaults (canonical): sub1=sku, sub2=merchant, sub3=tool, sub4=tuyetlethi
    const dflt = {
      sub1: guessSku(meta, card),
      sub2: merchant || (meta.dataset.merchant || "").toLowerCase(),
      sub3: "tool",
      sub4: "tuyetlethi",
    };
    // Allow explicit overrides via data-sub*
    const subs = { ...dflt };
    ["sub1", "sub2", "sub3", "sub4"].forEach((k) => {
      const v = meta.dataset[k];
      if (v) subs[k] = v;
    });
    return subs;
  };

  const deepLinkFor = (meta) => {
    const card = meta.closest?.(".product-card") || null;
    let origin = meta.getAttribute("href") || "#";
    const originAbs = absUrl(origin);
    const merchant = pickMerchant(meta, originAbs);
    const base = BASES[merchant];

    // If no base or origin already isclix => return origin untouched
    if (!base || isIsclix(originAbs)) return originAbs;

    const glue = base.includes("?") ? "&" : "?";
    const subs = buildSubs(meta, card, merchant);

    let url = `${base}${glue}url=${encodeURIComponent(originAbs)}`;
    Object.entries(subs).forEach(([k, v]) => {
      if (v != null && v !== "") url += `&${k}=${encodeURIComponent(String(v))}`;
    });
    return url;
  };

  const sendGA = (meta) => {
    try {
      if (typeof window.gtag === "function") {
        window.gtag("event", "aff_click", {
          event_category: "affiliate",
          event_label: meta.dataset.merchant || "",
          value: Number(meta.dataset.price) || undefined,
          merchant: meta.dataset.merchant || "",
          sku: meta.dataset.sku || "",
        });
      }
    } catch {}
  };

  const resolveMeta = (card) => {
    // Prefer explicit product-meta; fall back to first anchor
    return (
      card.querySelector("a.product-meta") ||
      card.querySelector("a[data-merchant]") ||
      card.querySelector("a[href]")
    );
  };

  const rewriteCard = (card) => {
    const meta = resolveMeta(card);
    if (!meta) return;
    const finalUrl = deepLinkFor(meta);
    card.querySelectorAll("a.buy").forEach((a) => {
      if (a.dataset.origin === "keep") return;
      a.href = finalUrl;
      a.rel = "nofollow noopener noreferrer";
    });
  };

  const rewriteAll = () => document.querySelectorAll(".product-card").forEach(rewriteCard);

  document.addEventListener("DOMContentLoaded", () => {
    rewriteAll();

    document.addEventListener("click", (ev) => {
      const btn = ev.target.closest("a.buy");
      if (!btn || btn.dataset.origin === "keep") return;
      const card = btn.closest(".product-card");
      const meta = card && resolveMeta(card);
      if (!meta) return;
      const finalUrl = deepLinkFor(meta);
      btn.href = finalUrl;
      sendGA(meta);
      ev.preventDefault();
      window.location.assign(finalUrl);
    });

    new MutationObserver((muts) => {
      muts.forEach((m) =>
        m.addedNodes &&
        m.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches?.(".product-card")) rewriteCard(node);
          node.querySelectorAll?.(".product-card").forEach(rewriteCard);
        })
      );
    }).observe(document.body, { childList: true, subtree: true });
  });
})();
