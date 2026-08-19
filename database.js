const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'data.json');

const CATEGORIES = {
  'Hammasi': [],
  'Texnika': ['Telefonlar', 'Noutbuklar', 'Planshetlar', 'Aksessuarlar', 'Boshqa'],
  'Maishiy': ['Oshxona', 'Kir yuvish', 'Tozalash', 'Sovutgichlar', 'Boshqa'],
  'Kiyim': ['Erkaklar', 'Ayollar', 'Bolalar', 'Poyabzallar', 'Boshqa'],
  'Oziq-ovqat': ['Sabzavotlar', 'Mevalar', 'Sut mahsulotlari', "Go'sht", 'Boshqa'],
  'Sport': ['Fitnes', 'Velosipedlar', 'Sport kiyim', 'Aksessuarlar', 'Boshqa'],
  'Boshqa': ['Xizmatlar', 'Hayvonlar', 'Kitoblar', 'Mebel', 'Boshqa']
};

const DEFAULT_COLLECTIONS = ['users', 'products', 'cartItems', 'likes', 'orders', 'messages', 'reports', 'reviews', 'offers', 'priceAlerts', 'phoneLinks'];
const DEFAULT_NEXT_ID = { users: 3, products: 13, cartItems: 1, likes: 1, orders: 1, messages: 1, reports: 1, reviews: 1, offers: 1, priceAlerts: 1, phoneLinks: 1 };

function load() {
  if (!fs.existsSync(DB_PATH)) {
    const data = getDefaultData();
    save(data);
    return data;
  }
  const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  for (const col of DEFAULT_COLLECTIONS) {
    if (!data[col]) data[col] = [];
  }
  if (!data.nextId) data.nextId = { ...DEFAULT_NEXT_ID };
  for (const key of Object.keys(DEFAULT_NEXT_ID)) {
    if (!data.nextId[key]) data.nextId[key] = DEFAULT_NEXT_ID[key];
  }
  return data;
}

function save(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function getDefaultData() {
  const hash = bcrypt.hashSync('123456', 10);
  const hashMain = bcrypt.hashSync('UzumOneali1004', 10);
  return {
    users: [
      { id: 1, name: 'Ali Seller', phone: '+998779633111', password: hashMain, role: 'admin', avatar: null, createdAt: new Date().toISOString() },
      { id: 2, name: 'Shaxnoza Seller', phone: '+998979888277', password: hashMain, role: 'seller', avatar: null, createdAt: new Date().toISOString() },
      { id: 3, name: "Yo'ldashali Seller", phone: '+998990118277', password: hashMain, role: 'seller', avatar: null, createdAt: new Date().toISOString() }
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

const db = {
  load,
  save,
  query(table) {
    const data = load();
    return {
      all() { return data[table] || []; },
      find(predicate) { return (data[table] || []).find(predicate); },
      filter(predicate) { return (data[table] || []).filter(predicate); },
      insert(item) {
        const list = data[table];
        const id = data.nextId[table] || 1;
        item.id = id;
        data.nextId[table] = id + 1;
        list.push(item);
        save(data);
        return item;
      },
      update(id, changes) {
        const list = data[table];
        const idx = list.findIndex(x => x.id === id);
        if (idx === -1) return null;
        list[idx] = { ...list[idx], ...changes };
        save(data);
        return list[idx];
      },
      delete(id) {
        const list = data[table];
        const idx = list.findIndex(x => x.id === id);
        if (idx === -1) return false;
        list.splice(idx, 1);
        save(data);
        return true;
      },
      updateWhere(predicate, changes) {
        const list = data[table];
        let count = 0;
        for (const item of list) {
          if (predicate(item)) {
            Object.assign(item, changes);
            count++;
          }
        }
        if (count > 0) save(data);
        return count;
      },
      deleteWhere(predicate) {
        const list = data[table];
        const toRemove = list.filter(predicate);
        for (const item of toRemove) {
          const idx = list.indexOf(item);
          list.splice(idx, 1);
        }
        save(data);
        return toRemove.length;
      }
    };
  }
};

module.exports = { db, CATEGORIES };
