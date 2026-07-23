# Media delivery — signed URLs (required before Deliveries build)

Delivery video is **private client content**. Do not start the Deliveries module until this approach is followed in code.

## Rules

1. **Private bucket only** — e.g. `media-deliveries` with `public: false`. Never serve delivery assets from a public bucket, including internal Nexa MVP.
2. **Signed URLs** — create short-lived signed URLs via Supabase Storage (`createSignedUrl`) for stream and download. Typical TTL: 60–300 seconds for playback; regenerate as needed.
3. **Path namespace** — object keys must include `account_id` (and `delivery_id`), e.g. `{account_id}/{delivery_id}/{asset_id}.mp4`.
4. **No permanent public URLs** — do not store or expose `getPublicUrl` for delivery media.
5. **Token page** — `/d/[token]` resolves the delivery metadata, then issues a signed URL to the player; password / expiry checks happen before signing.

## Portfolio note

Public portfolio may use a separate policy (public thumbs or longer-lived signed URLs). That does **not** relax the private-bucket rule for Deliveries.

## Implementation checklist (Deliveries build)

- [ ] Create private Storage bucket
- [ ] Upload path uses `account_id` only (no `client_slug`)
- [ ] API/helper: `createDeliverySignedUrl(path, expiresIn)`
- [ ] Public delivery page never embeds a permanent object URL
