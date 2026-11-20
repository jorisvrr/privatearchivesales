// Vercel Function: POST /api/enquiry — delivers a label's stock enquiry to Orvel.
import { handleEnquiry } from '../server/handlers';

export function POST(request: Request) {
  return handleEnquiry(request, process.env);
}
