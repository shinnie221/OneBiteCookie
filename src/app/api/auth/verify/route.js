import { verifyAuth } from '@/lib/auth';

export async function GET(request) {
  const staff = verifyAuth(request);
  if (!staff) {
    return Response.json({ error: 'Invalid token' }, { status: 401 });
  }
  return Response.json({ staff });
}
