import { updateProductStock as updateProductStockUtil } from '../utils/updateProductStock';

async function updateProductStock(job) {
  const { productId } = job.data || job;

  if (productId) {
    await updateProductStockUtil(productId);
    return productId;
  }
}

export default updateProductStock;
