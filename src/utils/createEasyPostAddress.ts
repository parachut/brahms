import EasyPost from '@easypost/api';
import uuid from 'uuid/v4';

import { Address } from '../models/Address';
import { pubSub } from '../redis';

const easyPost = new EasyPost(process.env.EASYPOST);

export const createEasyPostAddress = async (address) => {
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

  return address.save();
};