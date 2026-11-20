// Vercel Function: POST /api/subscribe — adds an address to Orvel's list (the second invitation).
import { handleSubscribe } from '../server/handlers';

export function POST(request: Request) {
  return handleSubscribe(request, process.env);
}
