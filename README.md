# WA Sticker Album

A production-ready Next.js 14 web application to manage WhatsApp sticker albums end-to-end: upload images, auto-process into WEBP, build sticker packs, export ZIPs, and share via WhatsApp links or QR codes.

## Fitur Utama
- **Manajemen Album**: buat, edit, dan atur visibilitas album (publik, unlisted, privat).
- **Upload & Konversi Sticker**: drag & drop banyak gambar (PNG/JPG/WEBP) otomatis dikonversi ke WEBP 512×512 dan thumbnail.
- **Pack Builder**: susun sticker pilihan, tetapkan urutan, ekspor ZIP dengan metadata.
- **Berbagi**: generate tautan wa.me, QR code, dan halaman album publik siap dibagikan.
- **PWA + Dark Mode**: mendukung instalasi perangkat dan tema terang/gelap mengikuti sistem.
- **Integrasi Supabase**: autentikasi email/OAuth, Postgres, serta Storage untuk file.

## Teknologi
- Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui.
- TanStack Query untuk data fetching & cache, Zod untuk validasi.
- Supabase (Auth, Postgres, Storage) + sharp untuk image processing.
- next-pwa untuk PWA, qrcode untuk QR generator.

## Persiapan Lingkungan
1. **Dependensi**
   ```bash
   pnpm install
   ```

2. **Konfigurasi `.env.local`**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

3. **Inisialisasi Supabase**
   - Instal CLI: `npm install -g supabase`
   - Login & init: `supabase init`
   - Jalankan migrasi SQL: `supabase db push`
   - Pastikan bucket Storage berikut tersedia: `stickers`, `packs`.

4. **Jalankan aplikasi**
   ```bash
   pnpm dev
   ```
   Akses di `http://localhost:3000`.

## Struktur Proyek
```
app/                # Routes (dashboard, auth, public, API)
components/         # UI components, wizard, uploader, share tools
hooks/              # Custom hooks (toast, upload queue)
lib/                # Utilitas (Supabase, QR, ZIP, image, WhatsApp)
public/icons/       # Ikon PWA
supabase/migrations # Skema database & kebijakan RLS
```

## Migrasi Database & Kebijakan RLS
SQL migrasi tersedia pada `supabase/migrations/0001_init.sql` mencakup:
- Tabel `profiles`, `albums`, `album_collaborators`, `stickers`, `packs`, `pack_items`, `shares`.
- Index sesuai kebutuhan query.
- Kebijakan RLS untuk memastikan hanya pemilik/kolaborator yang dapat mengelola konten privat, sementara album publik/unlisted dapat dibaca bebas.

Gunakan `supabase db push` untuk menerapkan skema dan kebijakan.

## Script NPM
- `pnpm dev` – jalankan Next.js dev server.
- `pnpm build` – build produksi.
- `pnpm start` – jalankan hasil build.
- `pnpm lint` – linting dengan ESLint.
- `pnpm format` – format kode dengan Prettier.
- `pnpm typecheck` – pemeriksaan tipe TypeScript.

## Deployment ke Vercel
1. Set environment variables pada Project Settings (lihat `.env.local`).
2. Tambahkan Supabase service role sebagai secret (`SUPABASE_SERVICE_ROLE_KEY`).
3. Pastikan bucket Storage sudah dibuat dan memberikan akses publik baca untuk file.
4. Deploy melalui Vercel CLI atau GitHub integration. Next.js + Supabase ready to go.

## WhatsApp Cloud API (Phase 2)
Struktur kode telah dipisahkan pada `lib/whatsapp.ts`. Untuk integrasi Cloud API:
- Tambahkan file baru `lib/whatsapp-cloud.ts` (placeholder sudah disediakan) untuk implementasi API WhatsApp resmi.
- Ganti pemanggilan `buildWaUrl` dengan fungsi Cloud API sesuai kebutuhan.
- Tambahkan konfigurasi token/secret pada environment variables.

## Testing Manual (Acceptance)
- **Buat Album**: Dashboard → “Buat Album”, album baru muncul di grid.
- **Upload Sticker**: Dalam album, unggah 3 gambar, pantau progress, thumbnail tampil.
- **Pack Builder**: Pilih 3 sticker, susun urutan, ekspor ZIP dan unduh link.
- **Share WhatsApp**: Tombol “Bagikan ke WhatsApp” membuka wa.me dengan pesan terisi dan QR muncul.
- **Album Publik**: Ubah visibilitas menjadi publik/unlisted, akses halaman publik tanpa login.

## Lisensi
MIT
