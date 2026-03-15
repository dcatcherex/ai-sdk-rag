import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { nanoid } from 'nanoid';
import sharp from 'sharp';
import { uploadPublicObject } from '@/lib/r2';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;  // 10 MB
const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200 MB

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) return new Response('Missing file', { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) {
    return new Response('Unsupported file type', { status: 415 });
  }

  const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);
  const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > maxBytes) {
    return new Response(`File too large (max ${isVideo ? '200' : '10'} MB)`, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const extMap: Record<string, string> = {
    'video/quicktime': 'mov',
    'image/gif': 'gif',
  };
  const ext = extMap[file.type] ?? (file.type.split('/')[1] ?? 'bin');
  const key = `content-marketing/${session.user.id}/${nanoid()}.${ext}`;

  // Get image dimensions (skip for video)
  let width: number | undefined;
  let height: number | undefined;
  if (!isVideo) {
    try {
      const meta = await sharp(buffer).metadata();
      width = meta.width;
      height = meta.height;
    } catch {
      // Non-fatal
    }
  }

  const { url } = await uploadPublicObject({
    key,
    body: buffer,
    contentType: file.type,
  });

  return Response.json({
    r2Key: key,
    url,
    mimeType: file.type,
    width,
    height,
    sizeBytes: file.size,
  });
}
