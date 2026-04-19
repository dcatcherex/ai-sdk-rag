import { auth } from '@/lib/auth';
import { generateText } from 'ai';
import { chatModel } from '@/lib/ai';
import { getBrandProfileAction, saveBrandProfileAction } from '@/features/brand-profile/service';

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const ctx = { userId: session.user.id };
  const profile = await getBrandProfileAction({}, ctx);
  const imageUrl = profile.data.fields['style_reference_url'];
  if (!imageUrl) return new Response('No style reference image uploaded', { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { text } = await generateText({
    model: chatModel as any,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', image: imageUrl },
          {
            type: 'text',
            text: 'Analyze this image and describe its visual style in 2–3 sentences for use as an AI image generation style guide. Cover: color palette, typography feel, layout/composition, mood, and overall aesthetic. Output the description only — no labels, no lists.',
          },
        ],
      },
    ],
  });

  const description = text.trim();
  await saveBrandProfileAction({ field: 'style_description', value: description }, ctx);

  return Response.json({ description });
}
