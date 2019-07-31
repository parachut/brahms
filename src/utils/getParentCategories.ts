import { Category } from '../models/Category';

export async function getParentCategories(category: Category) {
  const categories = [category];

  const getParent = async (child: Category) => {
    if (child.parent) {
      const parent = await Category.findByPk(child.parentId);

      if (parent) {
        categories.push(parent);

        if (parent.parent) {
          await getParent(parent);
        }
      }
    }
  };

  await getParent(category);

  return categories;
}
