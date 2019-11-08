import { sendEmail } from '../utils/sendEmail';

async function sendSimpleEmail(job) {
  const email = await sendEmail(job.data);

  console.log(email);

  return job.data;
}

export default sendSimpleEmail;
