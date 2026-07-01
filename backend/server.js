import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 9000;
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const missingEnv = !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.JWT_SECRET;
const supabase = missingEnv ? null : createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const productsSeed = [
  { name:'Wireless Headphones', category:'Electronics', brand:'Boat', price:1499, old_price:2999, image:'assets/headphones.svg', description:'Comfortable Bluetooth headphones with deep bass and long battery backup.', rating:4.5, stock:25 },
  { name:'Smart Watch', category:'Electronics', brand:'Noise', price:1999, old_price:3999, image:'assets/watch.svg', description:'Fitness tracking, calling support, heart rate monitor and waterproof body.', rating:4.4, stock:30 },
  { name:'Running Shoes', category:'Fashion', brand:'Campus', price:1299, old_price:2499, image:'assets/shoes.svg', description:'Lightweight running shoes for daily use, sports and college.', rating:4.2, stock:18 },
  { name:'School Backpack', category:'Fashion', brand:'Skybags', price:899, old_price:1599, image:'assets/bag.svg', description:'Strong backpack with laptop section and water-resistant material.', rating:4.3, stock:35 },
  { name:'Full HD Monitor', category:'Electronics', brand:'HP', price:7999, old_price:9999, image:'assets/monitor.svg', description:'24 inch Full HD display for coding, study, movies and gaming.', rating:4.6, stock:10 },
  { name:'Badminton Racket', category:'Sports', brand:'Yonex', price:2499, old_price:3299, image:'assets/racket.svg', description:'Lightweight racket with good grip for beginners and intermediate players.', rating:4.4, stock:14 },
  { name:'Study Table Lamp', category:'Home', brand:'Wipro', price:699, old_price:999, image:'assets/lamp.svg', description:'LED table lamp with brightness control and eye-care lighting.', rating:4.1, stock:28 },
  { name:'Gaming Keyboard', category:'Electronics', brand:'Zebronics', price:1199, old_price:1999, image:'assets/keyboard.svg', description:'RGB keyboard with smooth typing keys for gaming and coding.', rating:4.2, stock:21 }
];

function requireSupabase(req, res, next) {
  if (missingEnv) return res.status(500).json({ message: 'Supabase env missing. Check backend/.env file.' });
  next();
}

function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Login required' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

async function seedProducts() {
  const { count, error } = await supabase.from('products').select('*', { count: 'exact', head: true });
  if (error) throw error;
  if (count && count > 0) return;
  const { error: insertError } = await supabase.from('products').insert(productsSeed);
  if (insertError) throw insertError;
}

app.get('/api/health', (req, res) => res.json({ ok: true, port: PORT }));

app.post('/api/auth/register', requireSupabase, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'All fields required' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be minimum 6 characters' });

    const { data: exists } = await supabase.from('users_shopkart').select('id').eq('email', email).maybeSingle();
    if (exists) return res.status(409).json({ message: 'Email already registered' });

    const password_hash = await bcrypt.hash(password, 10);
    const { data: user, error } = await supabase.from('users_shopkart')
      .insert({ name, email, password_hash })
      .select('id,name,email')
      .single();
    if (error) throw error;

    const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/auth/login', requireSupabase, async (req, res) => {
  try {
    const { email, password } = req.body;
    const { data: user, error } = await supabase.from('users_shopkart').select('*').eq('email', email).maybeSingle();
    if (error) throw error;
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    const safeUser = { id: user.id, name: user.name, email: user.email };
    const token = jwt.sign(safeUser, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: safeUser });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/products', requireSupabase, auth, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const category = (req.query.category || '').trim();
    let query = supabase.from('products').select('*').order('created_at', { ascending: false });
    if (category) query = query.eq('category', category);
    if (q) query = query.or(`name.ilike.%${q}%,brand.ilike.%${q}%,category.ilike.%${q}%`);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/products/:id', requireSupabase, auth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('products').select('*').eq('id', req.params.id).single();
    if (error) return res.status(404).json({ message: 'Product not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/orders', requireSupabase, auth, async (req, res) => {
  try {
    const { items, address, phone } = req.body;
    if (!items?.length) return res.status(400).json({ message: 'Cart is empty' });
    if (!address || !phone) return res.status(400).json({ message: 'Address and phone required' });
    const total = items.reduce((sum, item) => sum + Number(item.price) * Number(item.qty), 0);
    const { data, error } = await supabase.from('orders')
      .insert({ user_id: req.user.id, items, address, phone, total })
      .select('*')
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/orders/my', requireSupabase, auth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('orders').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  if (missingEnv) return console.log('Supabase env missing. Add backend/.env first.');
  try {
    await seedProducts();
    console.log('Supabase connected and products ready');
  } catch (err) {
    console.log('Supabase error:', err.message);
  }
});
