const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const CATEGORIES = {
  'Hammasi': [],
  'Texnika': ['Telefonlar', 'Noutbuklar', 'Planshetlar', 'Aksessuarlar', 'Boshqa'],
  'Maishiy': ['Oshxona', 'Kir yuvish', 'Tozalash', 'Sovutgichlar', 'Boshqa'],
  'Kiyim': ['Erkaklar', 'Ayollar', 'Bolalar', 'Poyabzallar', 'Boshqa'],
  'Oziq-ovqat': ['Sabzavotlar', 'Mevalar', 'Sut mahsulotlari', "Go'sht", 'Boshqa'],
  'Sport': ['Fitnes', 'Velosipedlar', 'Sport kiyim', 'Aksessuarlar', 'Boshqa'],
  'Boshqa': ['Xizmatlar', 'Hayvonlar', 'Kitoblar', 'Mebel', 'Boshqa']
};

const TABLES = ['users', 'products', 'cartItems', 'likes', 'orders', 'messages', 'reports', 'reviews', 'offers', 'priceAlerts', 'phoneLinks'];

let pool = null;
let memData = null;
let dbReady = false;
let readyPromiseResolve = null;
const readyPromise = new Promise(r => { readyPromiseResolve = r; });

function getDefaultData() {
  const hash = bcrypt.hashSync('UzumOneali1004', 10);
  return {
    users: [
      { id: 1, name: 'Ali Seller', phone: '+998779633111', password: hash, role: 'admin', avatar: null, createdAt: new Date().toISOString() },
      { id: 2, name: 'Shaxnoza Seller', phone: '+998979888277', password: hash, role: 'seller', avatar: null, createdAt: new Date().toISOString() },
      { id: 3, name: "Yo'ldashali Seller", phone: '+998990118277', password: hash, role: 'seller', avatar: null, createdAt: new Date().toISOString() }
    ],
    products: [
      { id: 1, userId: 1, name: 'Samsung Galaxy S24 Ultra', price: 18999999, category: 'Texnika', subcategory: 'Telefonlar', description: '256GB, 12GB RAM, Snapdragon 8 Gen 3, S Pen, 200MP kamera, Titan Gray', images: ['https://images.unsplash.com/photo-1610945265064-0e34e551a22f?w=800&q=80','https://images.unsplash.com/photo-1610945265064-0e34e551a22f?w=400&q=80','https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=400&q=80'], location: 'Toshkent, Chilonzor', views: 142, createdAt: new Date().toISOString() },
      { id: 2, userId: 1, name: 'iPhone 15 Pro Max', price: 25999999, category: 'Texnika', subcategory: 'Telefonlar', description: '256GB, Titanium, A17 Pro chip, 48MP kamera, USB-C', images: ['https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&q=80','https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400&q=80','https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=400&q=80'], location: 'Toshkent, Yunusobod', views: 231, createdAt: new Date().toISOString() },
      { id: 3, userId: 2, name: 'Xiaomi 14T Pro', price: 8499999, category: 'Texnika', subcategory: 'Telefonlar', description: '512GB, 12GB RAM, MediaTek Dimensity 9300+, 50MP Leica kamera', images: ['https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=800&q=80','https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&q=80','https://images.unsplash.com/photo-1565849904461-04a58ad377e0?w=400&q=80'], location: 'Toshkent, Mirzo Ulugbek', views: 87, createdAt: new Date().toISOString() },
      { id: 4, userId: 2, name: 'MacBook Air M3', price: 13499999, category: 'Texnika', subcategory: 'Noutbuklar', description: '13.6", 8GB RAM, 256GB SSD, Liquid Retina, 18 soat batareya', images: ['https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80','https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=400&q=80','https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=400&q=80'], location: 'Toshkent, Shayxontohur', views: 156, createdAt: new Date().toISOString() },
      { id: 5, userId: 3, name: 'ASUS ROG Strix G16', price: 16199999, category: 'Texnika', subcategory: 'Noutbuklar', description: '16", Intel i9-13980HX, RTX 4070, 16GB RAM, 1TB SSD, 165Hz', images: ['https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=800&q=80','https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=400&q=80','https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=400&q=80'], location: 'Toshkent, Sergeli', views: 94, createdAt: new Date().toISOString() },
      { id: 6, userId: 3, name: 'Lenovo IdeaPad Slim 5', price: 5899999, category: 'Texnika', subcategory: 'Noutbuklar', description: '14", AMD Ryzen 7 7730U, 16GB RAM, 512GB SSD, IPS', images: ['https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&q=80','https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&q=80','https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=400&q=80'], location: 'Toshkent, Olmazor', views: 68, createdAt: new Date().toISOString() }
    ],
    cartItems: [],
    likes: [],
    orders: [],
    messages: [],
    reports: [],
    reviews: [],
    offers: [],
    priceAlerts: [],
    phoneLinks: [],
    nextId: { users: 4, products: 7, cartItems: 1, likes: 1, orders: 1, messages: 1, reports: 1, reviews: 1, offers: 1, priceAlerts: 1, phoneLinks: 1 }
  };
}

async function initDatabase() {
  if (process.env.DATABASE_URL) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS kv_store (
          key TEXT PRIMARY KEY,
          value JSONB NOT NULL
        )
      `);
      const res = await pool.query('SELECT key, value FROM kv_store');
      if (res.rows.length === 0) {
        memData = getDefaultData();
        await persistAll();
      } else {
        memData = {};
        for (const row of res.rows) {
          memData[row.key] = row.value;
        }
        for (const t of TABLES) {
          if (!memData[t]) memData[t] = [];
        }
        if (!memData.nextId) {
          memData.nextId = {};
          for (const t of TABLES) {
            const maxId = memData[t].reduce((mx, r) => Math.max(mx, r.id || 0), 0);
            memData.nextId[t] = maxId + 1;
          }
        }
      }
      dbReady = true;
      if (readyPromiseResolve) readyPromiseResolve();
      console.log('[DB] PostgreSQL connected');
    } catch (err) {
      console.error('[DB] PostgreSQL error, falling back to memory:', err.message);
      memData = getDefaultData();
      dbReady = true;
      if (readyPromiseResolve) readyPromiseResolve();
    }
  } else {
    memData = getDefaultData();
    dbReady = true;
    if (readyPromiseResolve) readyPromiseResolve();
    console.log('[DB] No DATABASE_URL, using in-memory defaults');
  }
}

async function persistAll() {
  if (!pool) return;
  try {
    for (const key of [...TABLES, 'nextId']) {
      await pool.query(
        'INSERT INTO kv_store (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
        [key, JSON.stringify(memData[key])]
      );
    }
  } catch (err) {
    console.error('[DB] Persist error:', err.message);
  }
}

function waitForReady() { return readyPromise; }

const db = {
  waitForReady,
  query(table) {
    return {
      all() { return memData[table] || []; },
      find(predicate) { return (memData[table] || []).find(predicate); },
      filter(predicate) { return (memData[table] || []).filter(predicate); },
      insert(item) {
        const list = memData[table];
        const id = memData.nextId[table] || 1;
        item.id = id;
        memData.nextId[table] = id + 1;
        list.push(item);
        persistAll();
        return item;
      },
      update(id, changes) {
        const list = memData[table];
        const idx = list.findIndex(x => x.id === id);
        if (idx === -1) return null;
        list[idx] = { ...list[idx], ...changes };
        persistAll();
        return list[idx];
      },
      delete(id) {
        const list = memData[table];
        const idx = list.findIndex(x => x.id === id);
        if (idx === -1) return false;
        list.splice(idx, 1);
        persistAll();
        return true;
      },
      updateWhere(predicate, changes) {
        const list = memData[table];
        let count = 0;
        for (const item of list) {
          if (predicate(item)) {
            Object.assign(item, changes);
            count++;
          }
        }
        if (count > 0) persistAll();
        return count;
      },
      deleteWhere(predicate) {
        const list = memData[table];
        const toRemove = list.filter(predicate);
        for (const item of toRemove) {
          const idx = list.indexOf(item);
          list.splice(idx, 1);
        }
        if (toRemove.length > 0) persistAll();
        return toRemove.length;
      }
    };
  }
};

module.exports = { db, CATEGORIES, initDatabase };
