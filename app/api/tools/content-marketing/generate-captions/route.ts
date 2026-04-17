import { requireUser } from "@/lib/auth-server";
import { generateCaptionsInputSchema } from '@/features/content-marketing/schema';
import { generateCaptions } from '@/features/content-marketing/service';
import { buildBrandContext } from '@/features/brands/service';

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

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
