import EasyPost from '@easypost/api';

const easyPost = new EasyPost(process.env.EASYPOST);

export const createEasyPostAddress = async (address) => {
  const easyPostAddress = new easyPost.Address({
    city: address.city,
    country: address.country,
    email: address.email,
    phone: address.phone,
    name: address.name,
    state: address.state,
    street1: address.street,
    street2: address.street2,
    zip: address.zip,
  });

  await easyPostAddress.save();

  address.residential = easyPostAddress.residential;
  address.zip = easyPostAddress.zip;
  address.easyPostId = easyPostAddress.id;

  return address.save();
};
