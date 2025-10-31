// FILE: /assets/importer-lite.js (REPLACE WHOLE FILE)
(function(){
  const $ = (s)=>document.querySelector(s);
  const log = (m)=>{ const el=$("#log"); el.textContent += (m+"\n"); el.scrollTop = el.scrollHeight; };

  // ---------- Utils ----------
  const guessMerchant = (u)=>{
    try{ const h=new URL(u).hostname;
      if(/shopee/i.test(h)) return 'shopee';
      if(/lazada/i.test(h)) return 'lazada';
      if(/tiktok/i.test(h)) return 'tiktok';
    }catch{} return '';
  };
  const slugify = (s)=> (s||'')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80);
  const parsePrice = (s)=>{
    if(s==null) return null;
    let str = String(s).trim();
    const hasK = /k\b/i.test(str);
    str = str.replace(/[^\d.,]/g,'').replace(/\.(?=\d{3}\b)/g,''); // bỏ . ngăn ngàn
    str = str.replace(/,/g,'.');
    let val = parseFloat(str);
    if(Number.isFinite(val)){ if(hasK) val = Math.round(val*1000); return Math.round(val); }
    const digits = str.replace(/\D+/g,''); return digits? parseInt(digits,10) : null;
  };
  const parseCSV = (txt)=>{
    const lines = txt.replace(/\r/g,'').split('\n').filter(x=>x.trim()!=='');
    if(!lines.length) return {headers:[],rows:[]};
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

  // ---------- State ----------
  let parsed = {headers:[], rows:[]};
  let mappedRows = [];   // từ CSV
  let merged = [];       // affiliates.json sau upsert
  let currentList = [];  // mục thêm thủ công / dán hàng loạt

  // Map mặc định từ CSV header → field đích
  const defaultMap = {
    "Mã sản phẩm":"sku",
    "Tên sản phẩm":"name",
    "Giá":"price_vnd",
    "Link sản phẩm":"origin_url",
    "Tên cửa hàng":"brand",
    "Tỉ lệ hoa hồng":"", "Hoa hồng":"", "Link ưu đãi":"", "Doanh thu":""
  };

  // ---------- DOM refs ----------
  const csvFile = $("#csvFile");
  const mapBox  = $("#mapBox");
  const merchantDefault = $("#merchantDefault");
  const skuPrefix = $("#skuPrefix");

  // ---------- CSV → preview/map ----------
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
        /link.*(sản.*phẩm|url)/i.test(hClean) ? 'origin_url' :
        /(mã|ma|code).*sp|sku/i.test(hClean) ? 'sku' : ''
      );
    });
    mapBox.value = JSON.stringify(map, null, 2);

    // preview vài dòng
    const tbl = document.createElement('table');
    const head = `<tr>${parsed.headers.map(h=>`<th>${h}</th>`).join('')}</tr>`;
    const body = parsed.rows.slice(0,10).map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('');
    tbl.innerHTML = head+body;
    $("#preview").innerHTML=''; $("#preview").appendChild(tbl);
    log("Đã đọc CSV. Kiểm tra map và bấm “Gộp…” để tiếp.");
  });

  // ---------- Helper thêm 1 item vào currentList ----------
  const renderManualList = ()=>{
    $("#manualList").textContent =
      currentList.map(p=>`${p.sku} | ${p.name} | ${p.price_vnd??''} | ${p.merchant} | ${p.origin_url}`).join("\n");
  };
  const addManualItem = ({name, origin, price, merchant, sku})=>{
    if(!name || !origin){ return; }
    if(!sku) sku = slugify(name);
    if(skuPrefix.value) sku = (skuPrefix.value + sku).replace(/--+/g,'-');
    const item = {
      name,
      sku,
      origin_url: origin,
      merchant: merchant || guessMerchant(origin) || '',
      image: `/assets/img/products/${sku}.webp`,
      price_vnd: parsePrice(price) ?? undefined,
      brand:'', status:true, updated_at:new Date().toISOString()
    };
    currentList.push(item);
    renderManualList();
    log(`Đã thêm: ${item.sku}`);
  };

  // ---------- Thêm nhanh 1 sản phẩm ----------
  $("#btnAddManual").addEventListener("click", ()=>{
    addManualItem({
      name: $("#mName").value.trim(),
      origin: $("#mUrl").value.trim(),
      price: $("#mPrice").value.trim(),
      merchant: $("#mMerchant").value,
      sku: $("#mSku").value.trim()
    });
    $("#mName").value = $("#mUrl").value = $("#mPrice").value = $("#mSku").value = "";
    $("#mMerchant").value = "";
  });

  // ---------- Dán hàng loạt ----------
  $("#btnBulk").addEventListener("click", ()=>{
    const box = document.querySelector('#bulkBox');
    const lines = (box.value||'').split(/\n+/).map(s=>s.trim()).filter(Boolean);
    if(!lines.length){ alert("Chưa có dòng nào."); return; }
    lines.forEach(line=>{
      const parts = line.split(/\s*\|\s*|\t|,\s*/); // | hoặc Tab hoặc ,
      const [name, origin, price, merchant='', sku=''] = parts;
      addManualItem({name, origin, price, merchant, sku});
    });
    box.value='';
  });

  // ---------- Gộp vào affiliates.json ----------
  $("#btnMerge").addEventListener("click", async ()=>{
    let m;
    try{ m = JSON.parse(mapBox.value||'{}'); }catch{ alert("Map không hợp lệ JSON."); return; }

    // fetch file hiện có
    let cur=[];
    try{
      cur = await (await fetch('/affiliates.json',{cache:'no-store'})).json();
      if(!Array.isArray(cur)) cur=[];
    }catch{ cur=[]; }
    const bySku = new Map(cur.map(x=>[x.sku,x]));

    // build từ CSV
    const hdr = parsed.headers; const idx=(name)=>hdr.findIndex(h=>h===name);
    mappedRows = parsed.rows.map((row)=>{
      const get = (dst)=>{
        const srcHeader = Object.keys(m).find(h=>m[h]===dst);
        if(!srcHeader) return '';
        const i = idx(srcHeader); if(i<0) return '';
        return row[i];
      };
      let name = get('name')||''; let sku = get('sku')||'';
      const origin = get('origin_url')||''; const brand=get('brand')||'';
      let price = get('price_vnd')||'';
      if(!sku) sku = slugify(name);
      if (skuPrefix.value) sku = (skuPrefix.value + sku).replace(/--+/g,'-');
      price = parsePrice(price);
      const merchant = merchantDefault.value || guessMerchant(origin) || '';
      const image = `/assets/img/products/${sku}.webp`;
      return {
        name, sku, origin_url: origin, merchant,
        image, brand: brand || '', price_vnd: price ?? undefined,
        status: true, updated_at: new Date().toISOString()
      };
    });

    // dedupe SKU
    const seen=new Set();
    mappedRows.forEach(it=>{
      let s=it.sku, i=2;
      while(seen.has(s) || bySku.has(s)){ s = `${it.sku}-${i++}`; }
      if(s!==it.sku){ log(`SKU trùng, đổi: ${it.sku} → ${s}`); it.sku=s; it.image=`/assets/img/products/${s}.webp`; }
      seen.add(s);
    });

    // upsert CSV + thủ công
    [...mappedRows, ...currentList].forEach(it=>{
      if(bySku.has(it.sku)){ bySku.set(it.sku, {...bySku.get(it.sku), ...it}); }
      else{ bySku.set(it.sku, it); }
    });

    merged = Array.from(bySku.values());

    // preview
    const tbl = document.createElement('table');
    tbl.innerHTML = `<tr><th>sku</th><th>name</th><th>price_vnd</th><th>merchant</th><th>origin_url</th><th>image</th></tr>` +
      [...mappedRows, ...currentList].slice(0,30).map(p=>
        `<tr><td>${p.sku}</td><td>${p.name}</td><td>${p.price_vnd??''}</td><td>${p.merchant}</td><td>${p.origin_url}</td><td>${p.image}</td></tr>`
      ).join('');
    $("#mergePreview").innerHTML=''; $("#mergePreview").appendChild(tbl);
    log(`Gộp xong. Tổng mục: ${merged.length} (mới/cập nhật: ${mappedRows.length + currentList.length}).`);
  });

  $("#btnDownload").addEventListener("click", ()=>{
    if(!merged.length){ alert("Chưa có dữ liệu gộp."); return; }
    const blob = new Blob([JSON.stringify(merged,null,2)], {type:'application/json;charset=utf-8'});
    const a = Object.assign(document.createElement('a'), {href:URL.createObjectURL(blob), download:'affiliates.json'});
    a.click(); URL.revokeObjectURL(a.href);
    log("Đã tải affiliates.json (mới). Lên GitHub → Upload file để ghi đè.");
  });

  // ---------- Ảnh: kéo-thả, convert → webp, ZIP ----------
  const drop = $("#drop"), imgInput=$("#imgFiles"), imgTable=$("#imgTable");
  const imagesMap = new Map(); // sku -> {blob, size}

  const readAsImage = (file)=> new Promise((resolve,reject)=>{
    const url = URL.createObjectURL(file);
    const img = new Image(); img.onload=()=>resolve({img,url}); img.onerror=reject; img.src=url;
  });
  const toWebpBlob = async (image) =>{
    const maxW = 2000, maxH = 2000;
    let w=image.naturalWidth, h=image.naturalHeight;
    if(w>maxW || h>maxH){ const r=Math.min(maxW/w, maxH/h); w=Math.round(w*r); h=Math.round(h*r); }
    const canvas = document.createElement('canvas');
    canvas.width=w; canvas.height=h;
    const ctx = canvas.getContext('2d'); ctx.drawImage(image,0,0,w,h);
    const data = canvas.toDataURL('image/webp', 0.9);
    const bin = atob(data.split(',')[1]);
    const arr = new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
    return new Blob([arr], {type:'image/webp'});
  };

  const refreshImgTable = ()=>{
    const rows = [...imagesMap.entries()]
      .map(([sku,info])=>`<tr><td><input data-sku="${sku}" class="sku-edit" value="${sku}"/></td><td>${(info.size/1024).toFixed(1)} KB</td><td><a class="btn small" href="${URL.createObjectURL(info.blob)}" download="${sku}.webp">Tải ảnh</a></td></tr>`)
      .join('');
    imgTable.innerHTML = rows ? `<table><tr><th>SKU</th><th>Kích thước</th><th>Tải</th></tr>${rows}</table>` : '<p>Chưa có ảnh.</p>';

    // cho phép sửa SKU gán ảnh
    imgTable.querySelectorAll('.sku-edit').forEach(inp=>{
      inp.addEventListener('change', e=>{
        const oldSku = e.target.dataset.sku;
        const newSku = slugify(e.target.value);
        if(!newSku){ e.target.value=oldSku; return; }
        const info = imagesMap.get(oldSku);
        imagesMap.delete(oldSku);
        imagesMap.set(newSku, info);
        refreshImgTable();
      });
    });
  };

  const handleFiles = async (files)=>{
    for(const f of files){
      const base = f.name.replace(/\.[^.]+$/,''); // tên file không đuôi
      const guessSku = slugify(base);
      const {img,url} = await readAsImage(f);
      try{
        const blob = await toWebpBlob(img);
        imagesMap.set(guessSku, {blob, size: blob.size});
        log(`Ảnh nhận: ${f.name} → ${guessSku}.webp (${(blob.size/1024).toFixed(1)} KB)`);
      }finally{ URL.revokeObjectURL(url); }
    }
    refreshImgTable();
  };

  ["dragenter","dragover"].forEach(ev=>drop?.addEventListener(ev,e=>{e.preventDefault(); drop.classList.add('drag');}));
  ["dragleave","drop"].forEach(ev=>drop?.addEventListener(ev,e=>{e.preventDefault(); drop.classList.remove('drag');}));
  drop?.addEventListener("drop", (e)=> handleFiles(e.dataTransfer.files));
  imgInput?.addEventListener("change", ()=> handleFiles(imgInput.files));

  $("#btnNeedList")?.addEventListener("click", ()=>{
    const list = (merged.length? merged : [...mappedRows, ...currentList]).map(p=>p.sku).join("\n");
    const a = Object.assign(document.createElement('a'), {href:URL.createObjectURL(new Blob([list],{type:'text/plain'})), download:'images-needed.txt'});
    a.click(); URL.revokeObjectURL(a.href);
  });

  $("#btnZip")?.addEventListener("click", async ()=>{
    if(!imagesMap.size){ alert("Chưa có ảnh."); return; }
    if(typeof JSZip==='undefined'){ alert("Không tải được JSZip CDN."); return; }
    const zip = new JSZip();
    imagesMap.forEach((info, sku)=> zip.file(`${sku}.webp`, info.blob));
    const blob = await zip.generateAsync({type:"blob"});
    const a = Object.assign(document.createElement('a'), {href:URL.createObjectURL(blob), download:'products-images.zip'});
    a.click(); URL.revokeObjectURL(a.href);
    log("Đã tạo ZIP ảnh. Upload toàn bộ vào /assets/img/products/.");
  });
})();
