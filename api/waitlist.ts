// Vercel Function: POST /api/waitlist — joins a drop's waitlist (round 1 with a verified order, else round 2).
import { handleWaitlist } from '../server/handlers.ts';

export function POST(request: Request) {
  return handleWaitlist(request, process.env);
}
