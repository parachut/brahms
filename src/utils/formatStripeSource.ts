import Stripe from 'stripe';
import omit from 'lodash/omit';
import { StripeBankAccount } from '../classes/stripeBankAccount';
import { StripeCard } from '../classes/stripeCard';

export const formatStripeSource = (source: Stripe.IStripeSource) => {
  if (source.object === 'bank_account') {
    const bankAccount = new StripeBankAccount();
    Object.assign(
      bankAccount,
      omit(source, ['bank_name', 'account_holder_name']),
    );
    bankAccount.bankName = source.bank_name;
    bankAccount.accountHolderName = source.account_holder_name;
    return bankAccount;
  }

  if (source.object === 'card') {
    const card = new StripeCard();
    Object.assign(card, omit(source, ['exp_month', 'exp_year']));
    card.expMonth = source.exp_month;
    card.expYear = source.exp_year;
    return card;
  }
};
