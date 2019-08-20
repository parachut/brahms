import EasyPost from '@easypost/api';
import uuid from 'uuid/v4';

import { Address } from '../models/Address';
import { pubSub } from '../redis';

const easyPost = new EasyPost(process.env.EASYPOST);

async function createEasyPostAddress(job) {
  const { addressId } = job.data;

  if (addressId) {
    const address = await Address.findByPk(addressId);

    const easyPostAddress = new easyPost.Address({
      city: address.city,
      country: address.country,
      email: address.email,
      phone: address.phone,
      name: address.name,
      state: address.state,
      street1: address.formattedStreet,
      zip: address.zip,
    });

    await easyPostAddress.save();

    address.residential = easyPostAddress.residential;
    address.zip = easyPostAddress.zip;
    address.easyPostId = easyPostAddress.id;

    await address.save();

    await pubSub.publish('ADDRESS_UPDATED', {
      id: uuid(),
      message: address,
    });

    return address;
  }
}

export default createEasyPostAddress;
