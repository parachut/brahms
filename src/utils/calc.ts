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
