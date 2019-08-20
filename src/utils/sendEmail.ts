import * as Postmark from 'postmark';

const postmark = new Postmark.ServerClient(process.env.POSTMARK);

export interface ISendEmailArgs {
  data: any;
  from?: string;
  to: string;
  id: number;
}

export async function sendEmail(email: ISendEmailArgs) {
  const { data = {}, from = 'support@parachut.co', id, to } = email;

  return postmark.sendEmailWithTemplate({
    From: from,
    TemplateId: id,
    TemplateModel: data,
    To: to,
  });
}
