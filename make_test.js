const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');
const inject = `<script>
(async function(){
  function out(label, html){
    var pre = document.createElement('pre');
    pre.id = label;
    pre.textContent = html;
    document.body.appendChild(pre);
  }
  try {
    await new Promise(r => setTimeout(r, 3000));
    await setLang('ru');
    await new Promise(r => setTimeout(r, 4000));
    openAddProd();
    await new Promise(r => setTimeout(r, 1500));
    out('MODAL_ADD', document.getElementById('addProdOv').innerHTML);
    out('MODAL_EDIT', document.getElementById('editProdOv').innerHTML);
    out('MODAL_GEO', document.getElementById('geoMapOv').innerHTML);
    out('LOCDD', (document.getElementById('locDDMenu') ? document.getElementById('locDDMenu').innerHTML : 'NO_LOCDD'));
    out('SORT', document.getElementById('sortFilter').outerHTML);
    out('COND', document.getElementById('condFilter').outerHTML);
    out('FILTER', (document.querySelector('.filter-row') ? document.querySelector('.filter-row').innerText : 'NO_FILTER'));
    out('LANG', 'LANG=' + LANG + ' curBtn=' + document.getElementById('curBtn').textContent);
    try { await openDetail(1); } catch(e) { out('ERR_DETAIL', String(e)); }
    await new Promise(r => setTimeout(r, 1500));
    out('DETAIL', document.getElementById('detailBody').innerHTML);
    out('BUYOV', (document.getElementById('buyOv') ? document.getElementById('buyOv').innerHTML : 'NO_BUYOV'));
    var st = document.getElementById('geoMapStatus');
    try { confirmGeoMap(); } catch(e) { out('ERR_CONFIRM', String(e)); }
    out('GEO_CONFIRM', st.textContent);
    try { openGeoMap('addProd'); } catch(e) { out('ERR_OPEN', String(e)); }
    await new Promise(r => setTimeout(r, 1500));
    out('GEO_AFTER_OPEN', st.textContent);
    out('SEC_FINAL', document.getElementById('secTitle').textContent);
    out('FINAL_STATE', JSON.stringify({ viaSt: st.textContent, viaG: document.getElementById('geoMapStatus').textContent, stSame: st === document.getElementById('geoMapStatus'), sec: document.getElementById('secTitle').textContent, bodyHasRu: document.body.innerText.indexOf('Все товары') >= 0, bodyHasUz: document.body.innerText.indexOf('Barcha mahsulotlar') >= 0, LANG: LANG }));
    out('BODY', document.body.innerText);
    renderCart();
    out('CART_EMPTY', (CART.items && CART.items.length ? 'FILLED' : document.getElementById('cartBody').innerHTML));
    var savedCart = CART.items;
    CART.items = [
      { id: 1, productId: 101, name: 'Test Mahsulot', price: '15000', quantity: 2, images: [], sellerName: 'Test Sotuvchi', sold: false },
      { id: 2, productId: 102, name: 'Sotilgan Mahsulot', price: '5000', quantity: 1, images: [], sellerName: 'Test Sotuvchi', sold: true }
    ];
    renderCart();
    out('CART_FULL', document.getElementById('cartBody').innerHTML);
    CART.items = savedCart;
    renderCart();
    await setLang('uz');
    await new Promise(r => setTimeout(r, 1500));
    out('MODAL_ADD_UZ', document.getElementById('addProdOv').innerHTML);
    out('LANG_UZ', 'LANG=' + LANG);
    out('SEC_UZ', document.getElementById('secTitle').textContent);
  } catch(e) {
    out('ERR', (e && e.stack) || String(e));
  }
})();
</script></body>`;
html = html.replace('</body>', inject);
fs.writeFileSync('public/test_tr.html', html);
console.log('written test_tr.html');
