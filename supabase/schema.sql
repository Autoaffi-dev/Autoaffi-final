create table profiles (
  id uuid primary key default uuid_generate_v4(),
  email text unique,
  plan text check (plan in ('basic', 'pro', 'elite')),
  referrer_id uuid references profiles(id),
  created_at timestamp default now()
);

create table leads (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references profiles(id),
  email text,
  name text,
  status text default 'new',
  created_at timestamp default now()
);

create table campaigns (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references profiles(id),
  subject text,
  message text,
  sent_at timestamp default now()
);