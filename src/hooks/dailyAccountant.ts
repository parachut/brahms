import { User } from '../models/User';

export async function easyPost(req, res) {
  if (
    process.env.STAGE === 'production' &&
    req.get('X-Appengine-Cron') !== 'true'
  ) {
    return res.status(401).end();
  }

  let totalBilled: number = 0;
  let totalCollections: number = 0;
  let totalMembers: number = 0;
  let totalItems: number = 0;

  const billingHour = new Date().getHours();

  const user = await User.findAll({
    where: {
      billingHour,
    },
    include: ['currentInventory'],
  });

  const { result } = req.body;
}
