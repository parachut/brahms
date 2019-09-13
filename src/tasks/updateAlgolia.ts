import { Category } from '../models/Category';
import { Product } from '../models/Product';

async function updateProductStock(job) {
  const { productId } = job.data || job;

  if (productId) {
    const products = await Product.findByPk(productId, {
      include: ['brand', 'category'],
    });

    const categories = await Category.findAll({});
  }
}

export default updateProductStock;
