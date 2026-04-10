# Media Upload — Implementation Guide

This document covers the standard media upload pipeline for Vaja AI. Every new feature that accepts user-uploaded images or files **must use this pattern** — do not write a new upload flow from scratch.

---

## Overview

All user-uploaded images go through a three-stage pipeline:

```
Client (FormData)
  → API route (auth + validation)
    → uploadImage() (Sharp optimize)
      → R2 (store WebP)
        → public URL returned to client
```

Non-image files (PDFs, fonts, documents) skip the optimization stage and are stored raw.

---

## File Map

```
lib/storage/
  uploadImage.ts         ← Standard entry point for all image uploads
  imageOptimization.ts   ← Sharp pipeline (format, quality, resize)
  index.ts               ← StorageService (uploadBuffer, uploadBase64, uploadFromUrl)
  config.ts              ← STORAGE_BUCKETS, IMAGE_OPTIMIZATION_CONFIG, validateFile()

lib/r2.ts                ← Raw S3 client (uploadPublicObject, downloadObject)

components/ui/
  image-upload-zone.tsx  ← Reusable UI: drag-and-drop + click-to-upload + preview (use this in all forms)
  file-upload-zone.tsx   ← Multi-file base64 zone (for local-preview flows only, not server uploads)

app/api/agents/image/route.ts         ← Agent cover upload (example: image-only endpoint)
app/api/brands/[id]/assets/route.ts   ← Brand assets (example: mixed image + non-image)
```

---

## The Standard Function: `uploadImage()`

**File:** `lib/storage/uploadImage.ts`

```typescript
import { uploadImage, UploadError } from '@/lib/storage/uploadImage';

const result = await uploadImage(file, {
  prefix: 'agent-covers/user-id-123',   // R2 key prefix — defines the folder
  optimization: {                         // optional, these are the defaults
    format: 'webp',
    quality: 85,
    maxWidth: 1200,
  },
  maxSizeBytes: 2 * 1024 * 1024,         // optional, defaults to 2 MB
});

// result: { url, key, originalSize, optimizedSize, contentType }
```

### What it does

1. Validates `file.type` against `image/jpeg`, `image/png`, `image/webp`, `image/gif`
2. Validates `file.size` against `maxSizeBytes`
3. Runs `optimizeImage()` from `imageOptimization.ts` (Sharp)
4. Uploads the optimized WebP buffer to R2 via `uploadPublicObject()`
5. Returns the public URL and size metadata

### Error handling

Validation failures throw `UploadError` with a `.status` (400). Catch it in your route:

```typescript
try {
  const result = await uploadImage(file, options);
  return Response.json({ url: result.url });
} catch (err) {
  if (err instanceof UploadError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  throw err; // unexpected — let Next.js handle it as 500
}
```

---

## R2 Key Naming Convention

```
{entity-type}/{scope-id}/{nanoid}.webp
```

| Entity | Key pattern | Example |
|--------|------------|---------|
| Agent cover | `agent-covers/{userId}/{nanoid}.webp` | `agent-covers/u_abc/xK9mP2.webp` |
| Brand image asset | `brand-assets/{brandId}/{nanoid}.webp` | `brand-assets/b_xyz/aQ3rL1.webp` |
| Skill asset (future) | `skill-assets/{skillId}/{nanoid}.webp` | `skill-assets/s_def/nJ7vR4.webp` |
| Tool artifact (future) | `tool-artifacts/{userId}/{nanoid}.webp` | `tool-artifacts/u_abc/mW5kP8.webp` |

Rules:
- Always use `nanoid()` for the filename — never use the original filename (security + collision avoidance)
- Always use the entity's owner ID or entity ID as the scope segment
- Always end with the output extension (`.webp` for images after optimization)

---

## Optimization Presets by Use Case

Choose settings based on how the image will be displayed:

| Use case | quality | maxWidth | maxHeight | Notes |
|----------|---------|----------|-----------|-------|
| Cover / thumbnail | 85 | 1200 | — | Agent covers, content thumbnails |
| Brand logo / creative | 90 | 2048 | — | Higher fidelity for brand assets |
| Reference image | 90 | 2048 | — | Style references, visual examples |
| Avatar / profile | 85 | 400 | 400 | Small square display |
| Full-page hero | 90 | 1920 | — | Landing page / rich media |

Pass these as the `optimization` option to `uploadImage()`.

---

## Adding a New Image Upload Endpoint

### Step 1 — Create the API route

```typescript
// app/api/[feature]/image/route.ts
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { uploadImage, UploadError } from '@/lib/storage/uploadImage';

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  try {
    const result = await uploadImage(file, {
      prefix: `your-entity-type/${session.user.id}`,
      optimization: { format: 'webp', quality: 85, maxWidth: 1200 },
    });
    return NextResponse.json({ url: result.url });
  } catch (err) {
    if (err instanceof UploadError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
```

### Step 2 — Add the upload UI

Use the shared `ImageUploadZone` component. It handles drag-and-drop, click-to-upload, preview thumbnail, uploading spinner, remove, and error display.

**File:** `components/ui/image-upload-zone.tsx`

```tsx
import { ImageUploadZone } from '@/components/ui/image-upload-zone';

// Define the upload function outside the component (avoids re-creation on render)
async function uploadMyCover(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/my-feature/image', { method: 'POST', body: formData });
  const json = await res.json() as { url?: string; error?: string };
  if (!res.ok) throw new Error(json.error ?? 'Upload failed');
  return json.url ?? '';
}

// In your component:
<ImageUploadZone
  label="Cover image"
  value={imageUrl}
  onChange={(url) => { markDirty(); setImageUrl(url); }}
  onUpload={uploadMyCover}
/>
```

**Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `string` | Yes | Current image URL. Empty string = no image. |
| `onChange` | `(url: string) => void` | Yes | Called with new URL after upload, or `''` on remove. |
| `onUpload` | `(file: File) => Promise<string>` | Yes | Upload handler — fetch your API, return the public URL. Throw an `Error` with a readable message on failure. |
| `label` | `string` | No | Field label shown above the zone. |
| `hint` | `string` | No | Small text below controls. Defaults to `'JPEG, PNG, WebP · max 2 MB'`. |
| `disabled` | `boolean` | No | Disables all interaction. |
| `className` | `string` | No | Applied to the outer wrapper. |

**For uploads with extra FormData fields** (e.g. brand assets with `kind`, `title`, `collection`), add drag-and-drop directly to the upload panel using the drag event pattern — see `features/brands/components/assets-tab.tsx` for the reference implementation.

### Step 3 — Persist the URL

The returned `url` is a permanent public R2 URL. Store it in your DB column (e.g. `image_url text`). No additional processing needed on save.

---

## Mixed Upload (Images + Non-Images)

When an endpoint accepts both image files and other file types (like brand assets accepting fonts and PDFs), branch on `file.type`:

```typescript
if (file.type.startsWith('image/')) {
  // use uploadImage() — optimized WebP output
  const result = await uploadImage(file, {
    prefix: `brand-assets/${brandId}`,
    optimization: { format: 'webp', quality: 90, maxWidth: 2048 },
    maxSizeBytes: 5 * 1024 * 1024,
  });
  // use result.url, result.key, result.contentType, result.optimizedSize
} else {
  // raw upload — fonts, PDFs, etc.
  const ext = file.name.split('.').pop() ?? 'bin';
  const key = `brand-assets/${brandId}/${nanoid()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { url } = await uploadPublicObject({ key, body: buffer, contentType: file.type });
  // use url, key, file.type, file.size
}
```

See `app/api/brands/[id]/assets/route.ts` for the full example.

---

## What NOT to Do

- **Do not** call `uploadPublicObject()` directly for user-uploaded images — this skips optimization and stores the raw original
- **Do not** store the original filename in the R2 key — use `nanoid()` only
- **Do not** call `optimizeImage()` directly in a route — go through `uploadImage()` so validation runs first
- **Do not** use base64 for user-uploaded images in form state — upload immediately on file select and store the URL
- **Do not** create a new `/api/upload` catch-all route — keep upload endpoints co-located with their feature (e.g. `/api/agents/image`, `/api/brands/[id]/assets`)

---

## Existing Upload Endpoints (Reference)

| Endpoint | Entity | Image only | Optimization |
|----------|--------|-----------|--------------|
| `POST /api/agents/image` | Agent cover | Yes | WebP 85, max 1200px |
| `POST /api/brands/[id]/assets` | Brand assets | No (mixed) | WebP 90, max 2048px (images only) |

When you add a new endpoint, add a row to this table.

---

## Generated Images (Different Flow)

AI-generated images (gallery, certificate, content) use a **different pipeline** — do not confuse them with user uploads:

```
generateImage() → KIE task → polling → URL returned by KIE
  → uploadFromUrl() [StorageService]  ← persists temporary KIE URL to permanent R2
  → stored in mediaAsset table
```

This flow lives in `features/image/service.ts` and `lib/storage/index.ts`. It never touches `uploadImage()`.

---

## Sharp Optimization Reference

`lib/storage/imageOptimization.ts` exposes:

| Function | Use |
|----------|-----|
| `optimizeImage(source, options)` | Full pipeline — any input source, any output format |
| `optimizeToWebP(source, quality, effort)` | Convenience — WebP only |
| `getImageBuffer(source)` | Extract Buffer from URL / base64 / File / Blob |
| `isImageFile(contentType)` | Check if a MIME type is an image |

`optimizeImage()` accepts `string` (URL or base64), `File`, `Blob`, `Buffer`, or `ArrayBuffer` as source. You do not need to pre-convert.

Available output formats: `webp` (default), `jpeg`, `png`, `avif`.

---

## Environment Variables Required

```
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_PUBLIC_BASE_URL     ← base URL prepended to all R2 keys to form public URLs
```

All are validated at startup via `lib/env.ts`. If any are missing, uploads will throw at runtime.
