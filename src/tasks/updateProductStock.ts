import { updateProductStock as updateProductStockUtil } from '../utils/updateProductStock';

async function updateProductStock(job) {
  const { productId } = job.data || job;

  if (productId) {
    try {
      await updateProductStockUtil(productId);
    } catch (e) {
      console.log(e);
    }
    return productId;
  }
}

export default updateProductStock;
