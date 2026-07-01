create extension if not exists pgcrypto;

create table if not exists users_shopkart (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  password_hash text not null,
  created_at timestamptz default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  brand text not null,
  price integer not null,
  old_price integer,
  image text not null,
  description text,
  rating numeric default 4.0,
  stock integer default 10,
  created_at timestamptz default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users_shopkart(id) on delete cascade,
  items jsonb not null,
  address text not null,
  phone text not null,
  total integer not null,
  status text default 'Order Placed',
  created_at timestamptz default now()
);
