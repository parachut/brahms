import { sendEmail } from '../utils/sendEmail';

async function sendSimpleEmail(job) {
  return sendEmail(job.data);
}

export default sendSimpleEmail;
