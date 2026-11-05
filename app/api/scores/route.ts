import { getScores } from '@/lib/scores';

export const dynamic = 'force-dynamic';

// Never fails: if ESPN is down the ticker just gets an empty list and skips the scores segment.
export async function GET() {
  try {
    return Response.json(await getScores(), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ games: [], leagues: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
