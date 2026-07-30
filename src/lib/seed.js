import { db } from './firebase.js';
import { collection, getDocs, addDoc, doc, setDoc } from 'firebase/firestore';
import bcrypt from 'bcryptjs';

// Cookie SVG data URIs as Base64 product images
function cookieSvg(color1, color2, label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <defs>
      <radialGradient id="g" cx="40%" cy="35%" r="60%">
        <stop offset="0%" stop-color="${color1}"/>
        <stop offset="100%" stop-color="${color2}"/>
      </radialGradient>
    </defs>
    <circle cx="100" cy="100" r="90" fill="url(#g)" stroke="${color2}" stroke-width="3"/>
    <circle cx="65" cy="70" r="8" fill="${color2}" opacity="0.6"/>
    <circle cx="120" cy="55" r="6" fill="${color2}" opacity="0.5"/>
    <circle cx="85" cy="120" r="9" fill="${color2}" opacity="0.65"/>
    <circle cx="135" cy="105" r="7" fill="${color2}" opacity="0.55"/>
    <circle cx="60" cy="130" r="5" fill="${color2}" opacity="0.45"/>
    <circle cx="145" cy="140" r="6" fill="${color2}" opacity="0.5"/>
    <text x="100" y="175" text-anchor="middle" font-size="11" fill="${color2}" font-family="sans-serif" font-weight="bold">${label}</text>
  </svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

export async function seedDatabase() {
  const productsRef = collection(db, 'products');
  const productsSnapshot = await getDocs(productsRef);
  
  if (!productsSnapshot.empty) {
    return; // Already seeded
  }

  console.log('🍪 Seeding database to Firebase...');

  // Seed products
  const products = [
    { name: 'Original Cookie', desc: 'Classic buttery cookie with a golden crunch. Our signature recipe perfected over years.', price: 8.90, stock: 50, c1: '#F5D6A8', c2: '#C4924A' },
    { name: 'Salted Caramel Cookie', desc: 'Sweet meets salty in this indulgent caramel-drizzled masterpiece.', price: 10.90, stock: 40, c1: '#E8C68A', c2: '#8B6914' },
    { name: 'Pistachio Cookie', desc: 'Nutty pistachio bliss with chunks of real pistachios in every bite.', price: 12.90, stock: 35, c1: '#B8D8B0', c2: '#5A8A4A' },
    { name: 'Strawberry Cream Cheese Cookie', desc: 'Fruity strawberry swirls with creamy cream cheese filling.', price: 11.90, stock: 30, c1: '#F5B0B0', c2: '#C75050' },
    { name: 'Double Chocolate Cookie', desc: 'Rich dark chocolate cookie loaded with milk and white chocolate chips.', price: 11.90, stock: 45, c1: '#8B6B5A', c2: '#4A2C1A' },
    { name: 'Matcha White Chocolate Cookie', desc: 'Premium Japanese matcha paired with sweet white chocolate chips.', price: 13.90, stock: 25, c1: '#A8D8A8', c2: '#4A7A3A' },
    { name: 'Red Velvet Cookie', desc: 'Velvety red cookie with cream cheese frosting center.', price: 12.90, stock: 30, c1: '#D87070', c2: '#8B2020' },
    { name: 'Lotus Biscoff Cookie', desc: 'Crunchy Biscoff cookie with a caramelized biscuit butter swirl.', price: 12.90, stock: 35, c1: '#D4A574', c2: '#8B5E3C' },
  ];

  for (const p of products) {
    const image = cookieSvg(p.c1, p.c2, p.name.split(' ')[0]);
    await addDoc(productsRef, {
      name: p.name,
      description: p.desc,
      price: p.price,
      stock: p.stock,
      available: true,
      image,
      createdAt: new Date().toISOString()
    });
  }

  // Seed vouchers
  const vouchersRef = collection(db, 'vouchers');
  await addDoc(vouchersRef, { code: 'WELCOME10', discount_type: 'percentage', discount_value: 10, min_order: 20, active: 1, created_at: new Date().toISOString() });
  await addDoc(vouchersRef, { code: 'ONEBITE5', discount_type: 'fixed', discount_value: 5, min_order: 30, active: 1, created_at: new Date().toISOString() });

  // Seed admin user
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  const usersRef = collection(db, 'users');
  await addDoc(usersRef, {
    name: 'Admin',
    email: 'admin@onebite.com',
    password: hashedPassword,
    role: 'admin',
    createdAt: new Date().toISOString()
  });

  // Seed default settings
  const settingsRef = doc(db, 'settings', 'config');
  await setDoc(settingsRef, {
    qr_code: '',
    delivery_enabled: 'true',
    shop_phone: '012-345-6789',
    shop_email: 'hello@onebite.com'
  });

  console.log('✅ Database seeded successfully!');
}
