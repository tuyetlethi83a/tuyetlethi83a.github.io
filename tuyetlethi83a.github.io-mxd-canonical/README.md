# https://tuyetlethi83a.github.io — MXD Canonical Skeleton

Chuẩn áp dụng (theo MXD210):
- **GA4 trước** `/assets/mxd-affiliate.js` (gắn đúng 1 lần/trang).
- **Canonical tuyệt đối** (https://…).
- Ảnh sản phẩm: `/assets/img/products/<sku>.webp` (tên file = SKU, đuôi `.webp`).
- **affiliates.json** là nguồn sự thật (name, sku, image, price_vnd, origin_url, merchant, category).
- `g.html` tạo Product JSON-LD, auto `noindex` nếu SKU không tồn tại.
- SW: HTML network-first; assets stale-while-revalidate (bump `VERSION` khi đổi asset).
- `store.html`: chỉ có **1 hub "Cửa hàng"**; danh mục con = `/store/<slug>.html` (thêm tile theo MXD Rule 53).

## Triển khai
1) Upload toàn bộ lên repo `tuyetlethi83a.github.io` (root).
2) Bật Pages: Settings → Pages → Source = `main` (root).
3) **Copy từ mxd210**:
   - `affiliates.json` (đè file hiện tại).
   - Tất cả ảnh sản phẩm vào `/assets/img/products/` (đúng SKU.webp).
   - Ảnh danh mục vào `/assets/img/categories/<slug>.webp` (nếu có).
   - (Tùy chọn) tạo thêm `/store/<slug>.html` rồi chèn tile vào `store.html` (xem MXD Rule 53).
4) Share link sản phẩm: `https://tuyetlethi83a.github.io/g.html?sku=<SKU>`.
