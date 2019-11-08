import * as Postmark from 'postmark';

const postmark = new Postmark.ServerClient(process.env.POSTMARK);

export interface ISendEmailArgs {
  data: any;
  from?: string;
  to: string;
  id: number;
  attachments?: [
    {
      Name: string;
      Content: string;
      ContentType: string;
      ContentID: string;
    },
  ];
}

export async function sendEmail(email: ISendEmailArgs) {
  const {
    data = {},
    from = 'support@parachut.co',
    id,
    to,
    attachments,
  } = email;

  return postmark.sendEmailWithTemplate({
    From: from,
    TemplateId: id,
    TemplateModel: data,
    To: to,
    Attachments: attachments,
  });
}
