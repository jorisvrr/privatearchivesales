// Vercel Function: POST /api/enquiry — delivers a founder's archive-sale enquiry (work email) to Orvel.
import { handleEnquiry } from '../server/handlers';

export function POST(request: Request) {
  return handleEnquiry(request, process.env);
}
