# Pre-launch checklist — public filmmaker signup

This is a **hard gate**, not a risk footnote.

Internal Nexa usage (agency + existing clients) may ship Portfolio / Deliveries before this checklist is green.

**Public self-serve signup of external filmmakers must not open until every blocker below is checked off.**

---

## Blockers (required)

### 1. Auth / tenant isolation

- [ ] Migrate session to **Supabase Auth**, **or**
- [ ] Implement **effective RLS** (or equivalent server-enforced isolation) covering at least:
  - [ ] `accounts`
  - [ ] `account_members`
  - [ ] Portfolio tables (when present)
  - [ ] Deliveries tables (when present)
  - [ ] Storage object paths namespaced by `account_id`

Until this is done, the app still uses custom `app_users` + anon policies suitable only for trusted agency/client operators.

### 2. Service-role API audit

- [ ] Inventory every route / server action / script that uses the Supabase **service role** key
- [ ] Confirm **100%** of those paths validate session (or a delivery token) before reading or mutating tenant data
- [ ] Sign-off in PR review before flipping public signup

---

## Non-blockers for this gate (track separately)

- Billing / Stripe
- Proposal generator
- Full migration off `client_slug` in legacy modules
- Usage-cap enforcement UI (limits columns already exist; enforcement comes later)

---

## Sign-off

| Gate | Owner | Date | Notes |
|------|-------|------|-------|
| Auth / RLS | | | |
| Service-role audit | | | |
| Public filmmaker signup enabled | | | **Do not enable until both blockers are done** |
