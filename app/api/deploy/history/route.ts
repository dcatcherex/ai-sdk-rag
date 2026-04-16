import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getDeployHistory } from '@/features/deploy/service'

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const history = await getDeployHistory(session.user.id)
  return Response.json(history)
}
