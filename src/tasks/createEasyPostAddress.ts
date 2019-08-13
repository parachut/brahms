import EasyPost from '@easypost/api';
import uuid from 'uuid/v4';

import { Address } from '../models/Address';
import { pubSub } from '../redis';

const easyPost = new EasyPost(process.env.EASYPOST);

export async function createEasyPostAddress(req, res) {
  const { addressId } = req.body;

  if (addressId && req.header('X-AppEngine-TaskName')) {
    const address = await Address.findByPk(addressId);

    const easyPostAddress = new easyPost.Address({
      city: address.city,
      country: address.country,
      email: address.email,
      phone: address.phone,
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

    return res
      .send(`Address easyPostId created: ${addressId} ${address.easyPostId}`)
      .end();
  }

  return res
    .status(500)
    .send('Not authorized')
    .end();
}
