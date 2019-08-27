import { User } from '../models/User';

async function updateUserPoints(job) {
  const { userId } = job.data || job;

  if (userId) {
    const user = await User.findByPk(userId, {
      include: [
        {
          association: 'currentInventory',
          include: ['product'],
        },
      ],
    });

    user.points = user.currentInventory.reduce(
      (r, i) => r + i.product.points,
      0,
    );

    await user.save();

    return user;
  }
}

export default updateUserPoints;
