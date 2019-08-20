import { sendEmail } from '../utils/sendEmail';

async function sendSimpleEmail(job) {
  await sendEmail(job.data);

  return job.data;
}

export default sendSimpleEmail;
