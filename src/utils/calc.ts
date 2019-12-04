import addMonths from 'date-fns/addMonths';
import differenceInCalendarDays from 'date-fns/differenceInCalendarDays';

export function calcDailyRate(points: number): number {
  if (!process.env.DAILY_RATE_PERCENT_MAX) {
    throw new Error('Missing environment variable DAILY_RATE_PERCENT_MAX');
  }

  if (!process.env.DAILY_RATE_PERCENT_MIN) {
    throw new Error('Missing environment variable DAILY_RATE_PERCENT_MIN');
  }

  let dailyRatePercent =
    parseInt(process.env.DAILY_RATE_PERCENT_MAX) -
    Math.floor(points / 1000) * 3.5;

  if (dailyRatePercent < 25)
    dailyRatePercent = parseInt(process.env.DAILY_RATE_PERCENT_MIN);

  return Math.ceil((points * (dailyRatePercent / 100)) / 30.1);
}

export function calcDailyCommission(points: number): number {
  if (!process.env.CONTRIBUTOR_PERCENT) {
    throw new Error('Missing environment variable CONTRIBUTOR_PERCENT');
  }

  return Number(
    (
      (points / 30.1) *
      (parseInt(process.env.CONTRIBUTOR_PERCENT) / 100)
    ).toFixed(2),
  );
}

export function calcProtectionDailyRate(points: number): number {
  if (!process.env.INSURANCE_PERCENT) {
    throw new Error('Missing environment variable INSURANCE_PERCENT');
  }

  const dailyRate = calcDailyRate(points);
  const protectionPlan = Math.ceil(
    dailyRate * (parseInt(process.env.INSURANCE_PERCENT) / 100),
  );
  return protectionPlan > 0 ? protectionPlan : 1;
}

export function calcUnlimitedTier(total: number): string {
  if (total > 1240 && total < 3500) {
    return '1500';
  } else if (total > 3500 && total < 4900) {
    return '3500';
  } else if (total > 4900) {
    return '7500';
  } else {
    return '750';
  }
}

export function calcItemLevel(total: number): string {
  if (total <= 1000) {
    return 'level-1';
  } else if (total > 1000 && total <= 2500) {
    return 'level-2';
  } else if (total > 2500 && total <= 5500) {
    return 'level-3';
  } else {
    return 'error';
  }
}

/**
 *
 * @param alpha New Monthly Price
 * @param beta Old Monthly Price
 * @param day Day of billing
 */
export function prorate(alpha: number, beta: number, day: number) {
  const dt = new Date();
  const month = dt.getMonth();
  const year = dt.getFullYear();

  const _day = day || new Date().getDate();

  const nextBillingDate = addMonths(new Date(year, month, _day), 1);
  const remaining = differenceInCalendarDays(nextBillingDate, dt);
  const billingDays = differenceInCalendarDays(
    nextBillingDate,
    new Date(year, month, _day),
  );

  const oldRemaining = beta / billingDays;
  const newRemaining = alpha / billingDays;

  return {
    amount: day ? remaining * (newRemaining - oldRemaining) : alpha,
    nextBillingDate,
  };
}
