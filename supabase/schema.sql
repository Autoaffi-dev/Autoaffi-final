-- users
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  name text,
  avatar_url text,
  plan text default 'free',
  follower_count int default 0,
  created_at timestamptz default now()
);

-- posts
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  title text,
  caption text,
  platform text,
  scheduled_at timestamptz,
  published_at timestamptz,
  status text default 'draft',
  created_at timestamptz default now()
);

-- affiliate_links
create table if not exists affiliate_links (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  user_id uuid references users(id),
  provider text,
  product_title text,
  affiliate_url text,
  commission numeric default 0,
  commission_type text,
  created_at timestamptz default now()
);

-- leads
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  creator_user_id uuid references users(id),
  email text,
  collected_at timestamptz default now(),
  source_post uuid references posts(id)
);

-- referrals
create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user text,
  referred_email text,
  created_at timestamptz default now()
);