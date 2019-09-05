import { updateProductStats as updateProductStatsUtil } from '../utils/updateProductStats';

async function updateProductStats(job) {
  const { productId } = job.data || job;

  if (productId) {
    await updateProductStatsUtil(productId);
    return productId;
  }
}

export default updateProductStats;
