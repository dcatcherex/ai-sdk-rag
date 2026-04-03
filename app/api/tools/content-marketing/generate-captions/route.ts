import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { generateCaptionsInputSchema } from '@/features/content-marketing/schema';
import { generateCaptions } from '@/features/content-marketing/service';
import { buildBrandContext } from '@/features/brands/service';

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const body = await req.json();
  const result = generateCaptionsInputSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  // Resolve brand context from brandId if not already provided
  let brandContext = result.data.brandContext;
  if (!brandContext && result.data.brandId) {
    try {
      brandContext = await buildBrandContext(result.data.brandId);
    } catch {
      // Non-fatal — proceed without brand context
    }
  }

  const captions = await generateCaptions({ ...result.data, brandContext });
  return Response.json(captions);
}
