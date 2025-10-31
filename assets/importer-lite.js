(function(){
  const $ = (s)=>document.querySelector(s);
  const log = (m)=>{ const el=$("#log"); el.textContent += (m+"\n"); el.scrollTop = el.scrollHeight; };

  // ---------- Utils ----------
  const hostSlug = ()=> (location.hostname.split('.')[0]||'site');
  const guessMerchant = (u)=>{ try{ const h=new URL(u).hostname;
    if(/shopee/i.test(h)) return 'shopee';
    if(/lazada/i.test(h)) return 'lazada';
    if(/tiktok/i.test(h)) return 'tiktok';
  }catch{} return ''; };
  const slugify = (s)=> (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80);
  const parsePrice = (s)=>{ if(s==null) return null; let str=String(s).trim();
    const hasK=/\bk\b/i.test(str); str=str.replace(/[^\d.,]/g,'').replace(/\.(?=\d{3}\b)/g,'').replace(/,/g,'.');
    let v=parseFloat(str); if(Number.isFinite(v)){ if(hasK) v=Math.round(v*1000); return Math.round(v); }
    const d=str.replace(/\D+/g,''); return d?parseInt(d,10):null; };
  const buildDeeplink = ({merchant, origin, bases, sub})=>{
    const base = (merchant==='shopee'?bases.shopee:merchant==='lazada'?bases.lazada:merchant==='tiktok'?bases.tiktok:'')||'';
    if(!base) return undefined;
    let url = base + '?url=' + encodeURIComponent(origin);
    if(sub.sub1) url += '&sub1=' + encodeURIComponent(sub.sub1);
    if(sub.sub2) url += '&sub2=' + encodeURIComponent(sub.sub2);
    if(sub.sub3) url += '&sub3=' + encodeURIComponent(sub.sub3);
    if(sub.sub4) url += '&sub4=' + encodeURIComponent(sub.sub4);
    return url;
  };

  // ---------- State ----------
  let parsed={headers:[],rows:[]}, mappedRows=[], merged=[], currentList=[];
  let deltaNew=[], deltaUpdated=[];

  // ---------- DOM refs ----------
  const csvFile = $("#csvFile"), mapBox = $("#mapBox");
  const merchantDefault=$("#merchantDefault"), skuPrefix=$("#skuPrefix");
  const catDefault=$("#catDefault"), featuredDefault=$("#featuredDefault");
  const baseShopee=$("#baseShopee"), baseTikTok=$("#baseTikTok"), baseLazada=$("#baseLazada");
  const sub1=$("#sub1"), sub2=$("#sub2"), sub3=$("#sub3"), sub4=$("#sub4");

  // ---------- CSV parse ----------
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
      } out.push(cur); return out;
    };
    const headers = split(lines[0]).map(h=>h.trim());
    const rows = lines.slice(1).map(l=>split(l));
    return {headers, rows};
  };

  $("#btnParse").addEventListener("click", async ()=>{
    const f = csvFile.files && csvFile.files[0];
    if(!f){ alert("Chọn file CSV trước."); return; }
    const txt = await f.text();
    parsed = parseCSV(txt);
    log(`CSV: ${parsed.rows.length} dòng, ${parsed.headers.length} cột.`);

    // auto-map
    const defaultMap={
      "Mã sản phẩm":"sku","SKU":"sku",
      "Tên sản phẩm":"name","Name":"name",
      "Giá":"price","price":"price","price_vnd":"price_vnd",
      "Link sản phẩm":"origin","origin":"origin","origin_url":"origin_url",
      "Merchant":"merchant","Tên cửa hàng":"brand","brand":"brand",
      "Category":"category","featured":"featured"
    };
    const map={};
    parsed.headers.forEach(h=>{
      const hc=h.trim();
      map[hc]= defaultMap[hc] ||
        (/tên.*sản.*phẩm/i.test(hc)?'name':
         /gi[aá]/i.test(hc)?'price':
         /link|url/i.test(hc)?'origin':
         /(mã|ma|code).*sp|sku/i.test(hc)?'sku':
         /categor/i.test(hc)?'category':'');
    });
    mapBox.value = JSON.stringify(map,null,2);

    const tbl=document.createElement('table');
    tbl.innerHTML = `<tr>${parsed.headers.map(h=>`<th>${h}</th>`).join('')}</tr>` +
      parsed.rows.slice(0,10).map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('');
    $("#preview").innerHTML=''; $("#preview").appendChild(tbl);
  });

  // ---------- Manual add / bulk ----------
  const renderManualList=()=>{ $("#manualList").textContent =
    currentList.map(p=>`${p.sku} | ${p.name} | ${p.price??p.price_vnd??''} | ${p.merchant} | ${p.origin}`).join("\n"); };

  const addManualItem = ({name, origin, price, merchant, sku, category, featured})=>{
    if(!name||!origin) return;
    if(!sku) sku = slugify(name);
    if(skuPrefix.value) sku=(skuPrefix.value+sku).replace(/--+/g,'-');
    const mm = merchant || merchantDefault.value || guessMerchant(origin) || '';
    const cat = category || catDefault.value || '';
    const feat = (typeof featured==='boolean'?featured:featuredDefault.checked) || false;
    const priceNum = parsePrice(price);
    const bases = {shopee: baseShopee.value.trim(), tiktok: baseTikTok.value.trim(), lazada: baseLazada.value.trim()};
    const deeplink = buildDeeplink({
      merchant:mm, origin, bases,
      sub:{
        sub1: (sub1.value==='sku'? sku : sub1.value||''),
        sub2: (sub2.value==='merchant'? mm : sub2.value||''),
        sub3: sub3.value||'',
        sub4: sub4.value||hostSlug()
      }
    });
    const item = {
      name, price: priceNum ?? undefined, // khóa “price” (chuẩn mxd210)
      origin, merchant: mm, sku,
      image: `/assets/img/products/${sku}.webp`,
      category: cat, brand:'', featured: !!feat,
      status: true, updated_at: new Date().toISOString(),
      deeplink,
      // khóa tương thích ngược:
      origin_url: origin, price_vnd: priceNum ?? undefined
    };
    currentList.push(item); renderManualList(); log(`Đã thêm: ${item.sku}`);
  };

  $("#btnAddManual").addEventListener("click", ()=>{
    addManualItem({
      name: $("#mName").value.trim(),
      origin: $("#mUrl").value.trim(),
      price: $("#mPrice").value.trim(),
      merchant: $("#mMerchant").value,
      sku: $("#mSku").value.trim(),
      category: $("#mCat").value.trim(),
      featured: $("#mFeatured").checked
    });
    ["#mName","#mUrl","#mPrice","#mSku","#mCat"].forEach(s=>$(s).value="");
    $("#mMerchant").value=""; $("#mFeatured").checked=false;
  });

  $("#btnBulk").addEventListener("click", ()=>{
    const box=$("#bulkBox");
    const lines=(box.value||'').split(/\n+/).map(s=>s.trim()).filter(Boolean);
    if(!lines.length){ alert("Chưa có dòng nào."); return; }
    lines.forEach(line=>{
      const [name,origin,price,merchant='',sku='',category='',featured=''] = line.split(/\s*\|\s*|\t|,\s*/);
      const feat = /^(1|true|yes|y|on|featured)$/i.test(String(featured||'').trim());
      addManualItem({name,origin,price,merchant,sku,category,featured:feat});
    });
    box.value='';
  });

  // ---------- Merge & Delta ----------
  $("#btnMerge").addEventListener("click", async ()=>{
    let map={}; try{ map=JSON.parse(mapBox.value||'{}'); }catch{ alert("Map không hợp lệ JSON."); return; }

    let cur=[]; try{ cur = await (await fetch('/affiliates.json',{cache:'no-store'})).json(); if(!Array.isArray(cur)) cur=[]; }catch{}
    const origBySku = new Map(cur.map(x=>[x.sku,x]));

    // CSV → mappedRows theo khóa mxd210
    const hdr = parsed.headers; const idx=(name)=>hdr.findIndex(h=>h===name);
    const getVal=(row,dst)=>{
      const src = Object.keys(map).find(h=>map[h]===dst);
      if(!src) return ''; const i=idx(src); return i<0?'':row[i];
    };
    mappedRows = parsed.rows.map(row=>{
      let name = getVal(row,'name')||''; let sku = getVal(row,'sku')||'';
      const origin = getVal(row,'origin') || getVal(row,'origin_url') || '';
      let price = getVal(row,'price') || getVal(row,'price_vnd') || '';
      let merchant = getVal(row,'merchant') || '';
      const category = getVal(row,'category') || catDefault.value || '';
      const brand = getVal(row,'brand') || '';
      const featuredStr = getVal(row,'featured');
      const featured = featuredStr ? /^(1|true|yes|y|on|featured)$/i.test(featuredStr) : featuredDefault.checked;

      if(!sku) sku = slugify(name);
      if(skuPrefix.value) sku=(skuPrefix.value+sku).replace(/--+/g,'-');
      price = parsePrice(price);
      if(!merchant) merchant = merchantDefault.value || guessMerchant(origin) || '';
      const bases = {shopee: baseShopee.value.trim(), tiktok: baseTikTok.value.trim(), lazada: baseLazada.value.trim()};
      const deeplink = buildDeeplink({
        merchant, origin, bases,
        sub:{
          sub1: (sub1.value==='sku'? sku : sub1.value||''),
          sub2: (sub2.value==='merchant'? merchant : sub2.value||''),
          sub3: sub3.value||'',
          sub4: sub4.value||hostSlug()
        }
      });

      return {
        name, price: price ?? undefined, origin, merchant, sku,
        image:`/assets/img/products/${sku}.webp`,
        category, brand, featured: !!featured, status:true, updated_at:new Date().toISOString(),
        deeplink,
        // tương thích ngược:
        origin_url: origin, price_vnd: price ?? undefined
      };
    });

    // Dedupe SKU đụng file gốc
    const bySku = new Map(cur.map(x=>[x.sku,x])); const seen=new Set();
    mappedRows.forEach(it=>{
      let s=it.sku, i=2; while(seen.has(s)||bySku.has(s)){ s=`${it.sku}-${i++}`; }
      if(s!==it.sku){ log(`SKU trùng, đổi: ${it.sku} → ${s}`); it.sku=s; it.image=`/assets/img/products/${s}.webp`; }
      seen.add(s);
    });

    // Delta trước khi upsert
    const incoming = [...mappedRows, ...currentList];
    const diffKeys = ['name','origin','image','price','merchant','brand','category','featured','status','deeplink'];
    deltaNew = incoming.filter(it => !origBySku.has(it.sku));
    deltaUpdated = incoming.filter(it=>{
      const old=origBySku.get(it.sku); if(!old) return false;
      return diffKeys.some(k => (it[k] ?? null) !== (old[k] ?? null));
    });

    // Upsert
    incoming.forEach(it=>{
      if(bySku.has(it.sku)) bySku.set(it.sku,{...bySku.get(it.sku),...it});
      else bySku.set(it.sku,it);
    });
    merged = Array.from(bySku.values());

    // Preview
    const tbl=document.createElement('table');
    tbl.innerHTML = `<tr><th>sku</th><th>name</th><th>price</th><th>merchant</th><th>origin</th><th>category</th><th>featured</th><th>deeplink</th></tr>`+
      incoming.slice(0,30).map(p=>`<tr><td>${p.sku}</td><td>${p.name}</td><td>${p.price??''}</td><td>${p.merchant}</td><td>${p.origin}</td><td>${p.category||''}</td><td>${p.featured?'✓':''}</td><td>${p.deeplink? '…yes' : ''}</td></tr>`).join('');
    $("#mergePreview").innerHTML=''; $("#mergePreview").appendChild(tbl);
    log(`Gộp xong. Tổng mục: ${merged.length} (mới:${deltaNew.length} / cập nhật:${deltaUpdated.length}).`);
  });

  const downloadJson=(filename,data)=>{
    const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'});
    const a = Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:filename});
    a.click(); URL.revokeObjectURL(a.href);
  };
  $("#btnDownload").addEventListener("click", ()=>{
    if(!merged.length){ alert("Chưa có dữ liệu gộp."); return; }
    downloadJson('affiliates.json', merged);
  });
  $("#btnDownloadDeltaNew").addEventListener("click", ()=>{
    if(!deltaNew.length){ alert("Không có mục mới."); return; }
    downloadJson('delta-new.json', deltaNew);
  });
  $("#btnDownloadDeltaUpdated").addEventListener("click", ()=>{
    if(!deltaUpdated.length){ alert("Không có mục cập nhật."); return; }
    downloadJson('delta-updated.json', deltaUpdated);
  });

  // ---------- Images: drag→webp→ZIP ----------
  const drop=$("#drop"), imgInput=$("#imgFiles"), imgTable=$("#imgTable"); const imagesMap=new Map();
  const readAsImage=(file)=> new Promise((res,rej)=>{ const url=URL.createObjectURL(file); const img=new Image();
    img.onload=()=>res({img,url}); img.onerror=rej; img.src=url; });
  const toWebpBlob=async(image)=>{ const maxW=2000,maxH=2000; let w=image.naturalWidth,h=image.naturalHeight;
    if(w>maxW||h>maxH){ const r=Math.min(maxW/w,maxH/h); w=Math.round(w*r); h=Math.round(h*r); }
    const c=document.createElement('canvas'); c.width=w; c.height=h; const g=c.getContext('2d'); g.drawImage(image,0,0,w,h);
    const data=c.toDataURL('image/webp',0.9); const bin=atob(data.split(',')[1]); const arr=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i); return new Blob([arr],{type:'image/webp'}); };
  const slugifyName=(name)=>slugify(name.replace(/\.[^.]+$/,''));
  const refreshImgTable=()=>{ const rows=[...imagesMap.entries()].map(([sku,info])=>
    `<tr><td><input data-sku="${sku}" class="sku-edit" value="${sku}"/></td><td>${(info.size/1024).toFixed(1)} KB</td><td><a class="btn small" href="${URL.createObjectURL(info.blob)}" download="${sku}.webp">Tải ảnh</a></td></tr>`).join('');
    imgTable.innerHTML= rows? `<table><tr><th>SKU</th><th>Kích thước</th><th>Tải</th></tr>${rows}</table>`:'<p>Chưa có ảnh.</p>';
    imgTable.querySelectorAll('.sku-edit').forEach(inp=>{
      inp.addEventListener('change',e=>{ const old=e.target.dataset.sku; const nw=slugify(e.target.value);
        if(!nw){ e.target.value=old; return; } const info=imagesMap.get(old); imagesMap.delete(old); imagesMap.set(nw,info); refreshImgTable(); });
    });
  };
  const handleFiles=async(files)=>{ for(const f of files){
      const base=slugifyName(f.name); const {img,url}=await readAsImage(f);
      try{ const blob=await toWebpBlob(img); imagesMap.set(base,{blob,size:blob.size}); log(`Ảnh: ${f.name} → ${base}.webp (${(blob.size/1024).toFixed(1)} KB)`); }
      finally{ URL.revokeObjectURL(url); } } refreshImgTable(); };
  ["dragenter","dragover"].forEach(ev=>drop?.addEventListener(ev,e=>{e.preventDefault(); drop.classList.add('drag');}));
  ["dragleave","drop"].forEach(ev=>drop?.addEventListener(ev,e=>{e.preventDefault(); drop.classList.remove('drag');}));
  drop?.addEventListener("drop",(e)=>handleFiles(e.dataTransfer.files));
  imgInput?.addEventListener("change",()=>handleFiles(imgInput.files));
  $("#btnNeedList")?.addEventListener("click",()=>{
    const list=(merged.length?merged:[...mappedRows,...currentList]).map(p=>p.sku).join("\n");
    downloadJson('images-needed.txt', list);
  });
  $("#btnZip")?.addEventListener("click",async()=>{
    if(!imagesMap.size){ alert("Chưa có ảnh."); return; }
    if(typeof JSZip==='undefined'){ alert("Không tải được JSZip."); return; }
    const zip=new JSZip(); imagesMap.forEach((info,sku)=>zip.file(`${sku}.webp`,info.blob));
    const blob=await zip.generateAsync({type:"blob"}); const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:'products-images.zip'}); a.click(); URL.revokeObjectURL(a.href);
    log("Đã tạo ZIP ảnh. Upload toàn bộ vào /assets/img/products/.");
  });
})();
