// CREATE WHOLE FILE: /assets/importer-lite.js
(function(){
  const $ = (s)=>document.querySelector(s);
  const log = (m)=>{ const el=$("#log"); el.textContent += (m+"\n"); el.scrollTop = el.scrollHeight; };
  const guessMerchant = (u)=>{
    try{
      const h = new URL(u).hostname;
      if(/shopee/i.test(h)) return 'shopee';
      if(/lazada/i.test(h)) return 'lazada';
      if(/tiktok/i.test(h)) return 'tiktok';
    }catch{}
    return '';
  };
  const slugify = (s)=>{
    return (s||'')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase().replace(/[^a-z0-9]+/g,'-')
      .replace(/^-+|-+$/g,'').slice(0,60);
  };
  const parsePrice = (s)=>{
    if (s==null) return null;
    let str = String(s).trim();
    // 327,3k  → 327300 ;  "₫26.182" → 26182 ; "99.000"→ 99000
    const hasK = /k\b/i.test(str);
    str = str.replace(/[^\d.,]/g,'').replace(/\.(?=\d{3}\b)/g,''); // bỏ . ngăn ngàn
    str = str.replace(/,/g,'.');
    let val = parseFloat(str);
    if (Number.isFinite(val)) {
      if (hasK) val = Math.round(val * 1000);
      return Math.round(val);
    }
    const digits = str.replace(/\D+/g,'');
    return digits? parseInt(digits,10) : null;
  };
  const parseCSV = (txt)=>{
    // nhẹ nhàng: hỗ trợ "double-quoted"
    const lines = txt.replace(/\r/g,'').split('\n').filter(x=>x.trim()!=='');
    if (!lines.length) return {headers:[], rows:[]};
    const split = (line)=>{
      const out=[]; let cur='', q=false;
      for(let i=0;i<line.length;i++){
        const ch=line[i], nx=line[i+1];
        if(ch==='"' && nx==='"'){ cur+='"'; i++; continue; }
        if(ch==='"'){ q=!q; continue; }
        if(ch===',' && !q){ out.push(cur); cur=''; continue; }
        cur+=ch;
      }
      out.push(cur); return out;
    };
    const headers = split(lines[0]).map(h=>h.trim());
    const rows = lines.slice(1).map(l=>split(l));
    return {headers, rows};
  };

  let parsed = {headers:[], rows:[]}, mapped = [], merged = [];
  const defaultMap = {
    // key = CSV header gốc → value = field đích
    "Mã sản phẩm":"sku",
    "Tên sản phẩm":"name",
    "Giá":"price_vnd",
    "Link sản phẩm":"origin_url",
    "Tên cửa hàng":"brand",
    "Tỉ lệ hoa hồng":"", "Hoa hồng":"", "Link ưu đãi":"", "Doanh thu":""
  };

  const csvFile = $("#csvFile");
  const mapBox = $("#mapBox");
  const merchantDefault = $("#merchantDefault");
  const skuPrefix = $("#skuPrefix");

  $("#btnParse").addEventListener("click", async ()=>{
    const f = csvFile.files && csvFile.files[0];
    if(!f){ alert("Chọn file CSV trước."); return; }
    const txt = await f.text();
    parsed = parseCSV(txt);
    log(`CSV: ${parsed.rows.length} dòng, ${parsed.headers.length} cột.`);
    // auto map header
    const map = {};
    parsed.headers.forEach(h=>{
      const hClean = h.trim();
      map[hClean] = defaultMap[hClean] || (
        /tên.*sản.*phẩm/i.test(hClean) ? 'name' :
        /gi[aá]/i.test(hClean) ? 'price_vnd' :
        /link.*sản.*phẩm|url/i.test(hClean) ? 'origin_url' :
        /m[aã] s[aả]n ph[aẩ]m|sku|m[aã] sp/i.test(hClean) ? 'sku' :
        ''
      );
    });
    mapBox.value = JSON.stringify(map, null, 2);

    // preview vài dòng
    const tbl = document.createElement('table');
    const head = `<tr>${parsed.headers.map(h=>`<th>${h}</th>`).join('')}</tr>`;
    const body = parsed.rows.slice(0,10).map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('');
    tbl.innerHTML = head+body;
    const preview = $("#preview"); preview.innerHTML=''; preview.appendChild(tbl);
    log("Đã đọc CSV. Kiểm tra map và bấm “Gộp…” để tiếp.");
  });

  $("#btnMerge").addEventListener("click", async ()=>{
    if(!parsed.rows.length){ alert("Chưa có dữ liệu CSV."); return; }
    let m;
    try{ m = JSON.parse(mapBox.value||'{}'); }catch{ alert("Map không hợp lệ JSON."); return; }

    // fetch affiliates.json hiện có
    let cur=[];
    try{
      cur = await (await fetch('/affiliates.json',{cache:'no-store'})).json();
      if(!Array.isArray(cur)) cur=[];
    }catch{ cur=[]; }
    const bySku = new Map(cur.map(x=>[x.sku,x]));

    // build entries từ CSV
    const hdr = parsed.headers;
    const idx = (name)=> hdr.findIndex(h=>h===name);

    mapped = parsed.rows.map((row)=>{
      const get = (dst)=>{
        const srcHeader = Object.keys(m).find(h=>m[h]===dst);
        if(!srcHeader) return '';
        const i = idx(srcHeader); if(i<0) return '';
        return row[i];
      };
      let name = get('name')||'';
      let sku = get('sku')||'';
      const origin = get('origin_url')||'';
      const brand = get('brand')||'';
      let price = get('price_vnd')||'';
      // fallback sku theo name
      if(!sku) sku = slugify(name);
      if (skuPrefix.value) sku = (skuPrefix.value + sku).replace(/--+/g,'-');
      // normalize
      price = parsePrice(price);
      const merchant = merchantDefault.value || guessMerchant(origin) || '';
      const image = `/assets/img/products/${sku}.webp`;
      return {
        name, sku, origin_url: origin, merchant,
        image, brand: brand || '', price_vnd: price ?? undefined,
        status: true, updated_at: new Date().toISOString()
      };
    });

    // ensure unique SKU
    const seen=new Set();
    mapped.forEach(it=>{
      let s=it.sku, i=1;
      while(seen.has(s) || bySku.has(s)){ s = it.sku + '-' + i++; }
      if(s!==it.sku){ log(`SKU trùng, đổi: ${it.sku} → ${s}`); it.sku=s; it.image=`/assets/img/products/${s}.webp`; }
      seen.add(s);
    });

    // upsert
    mapped.forEach(it=>{
      if(bySku.has(it.sku)){
        const old = bySku.get(it.sku);
        bySku.set(it.sku, {...old, ...it}); // merge mềm
      }else{
        bySku.set(it.sku, it);
      }
    });

    merged = Array.from(bySku.values());
    log(`Gộp xong. Tổng mục: ${merged.length} (mới/ cập nhật: ${mapped.length}).`);

    // preview bảng ngắn
    const tbl = document.createElement('table');
    tbl.innerHTML = `<tr><th>sku</th><th>name</th><th>price_vnd</th><th>merchant</th><th>origin_url</th><th>image</th></tr>` +
      mapped.slice(0,20).map(p=>`<tr><td>${p.sku}</td><td>${p.name}</td><td>${p.price_vnd??''}</td><td>${p.merchant}</td><td>${p.origin_url}</td><td>${p.image}</td></tr>`).join('');
    const wrap=$("#mergePreview"); wrap.innerHTML=''; wrap.appendChild(tbl);
  });

  $("#btnDownload").addEventListener("click", ()=>{
    if(!merged.length){ alert("Chưa có dữ liệu gộp."); return; }
    const blob = new Blob([JSON.stringify(merged,null,2)], {type:'application/json;charset=utf-8'});
    const a = Object.assign(document.createElement('a'), {href:URL.createObjectURL(blob), download:'affiliates.json'});
    a.click(); URL.revokeObjectURL(a.href);
    log("Đã tải affiliates.json (mới). Vào GitHub → Add file → Upload files → chọn file này để ghi đè.");
  });

  $("#btnImagesList").addEventListener("click", ()=>{
    if(!mapped.length){ alert("Chưa có dữ liệu mới."); return; }
    const lines = mapped.map(p=>p.image.replace(/^.*\/products\//,'')).join('\n');
    const blob = new Blob([lines], {type:'text/plain;charset=utf-8'});
    const a = Object.assign(document.createElement('a'), {href:URL.createObjectURL(blob), download:'images-to-upload.txt'});
    a.click(); URL.revokeObjectURL(a.href);
    log("Đã tải danh sách ảnh cần up (1 ảnh/sku, .webp).");
  });
})();
