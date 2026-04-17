import { requireUser } from '@/lib/auth-server'
import { getDeployHistory } from '@/features/deploy/service'

export async function GET() {
  const authResult = await requireUser()
  if (!authResult.ok) return authResult.response

  const history = await getDeployHistory(authResult.user.id)
  return Response.json(history)
}
