# Supabase Auth Setup

Add these variables to `frontend/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

In the Supabase dashboard:

1. Open `Authentication` -> `Providers`.
2. Enable `Email`.
3. If you want instant local sign-in during development, disable email confirmation or confirm the user from the dashboard after signup.

This app stores the selected role in Supabase Auth `user_metadata.role` with one of these values:

- `client`
- `freelancer`

The role controls:

- `/dashboard/client`
- `/dashboard/freelancer`
- bounty creation access
- submission access
