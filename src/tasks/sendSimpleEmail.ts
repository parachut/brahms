import { sendEmail } from '../utils/sendEmail'

async function sendSimpleEmail (job) {
  try {
    await sendEmail(job.data)
  } catch (e) {
    console.log(e)
  }

  return 'sent'
}

export default sendSimpleEmail
