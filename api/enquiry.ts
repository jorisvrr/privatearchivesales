// Vercel Function: POST /api/enquiry — delivers a founder's archive-sale enquiry (work email) to Mino.
import { handleEnquiry } from '../server/handlers.ts';

export function POST(request: Request) {
  return handleEnquiry(request, process.env);
}
