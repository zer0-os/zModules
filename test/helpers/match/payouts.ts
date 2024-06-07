
export const getPayouts = ({
  playerCount,
  matchFee,
  gameFeePerc,
} : {
  playerCount : bigint;
  matchFee : bigint;
  gameFeePerc : bigint;
}) => {
  const gameFee = (matchFee * gameFeePerc) / 10000n;
  const totalPayoutRef = matchFee * playerCount - gameFee;
  const place1 = totalPayoutRef / 100n * 30n;
  const place2 = totalPayoutRef / 100n * 20n;
  const place3 = totalPayoutRef / 100n * 10n;
  const nonPrizedCount = playerCount - 3n;
  const leftover = totalPayoutRef / 100n * 40n;
  const rest = leftover / nonPrizedCount;

  const payouts = [
    place1,
    place2,
    place3,
    ...Array(Number(nonPrizedCount)).fill(rest),
  ];

  const totalPayout = payouts.reduce(
    (acc, val) => acc + val,
    0n
  );

  // if we have rounding errors, we take the difference and add it to one of the payouts
  const totalPayoutDiff = totalPayoutRef - totalPayout;
  if (totalPayoutDiff > 0n) {
    payouts[4] += totalPayoutDiff;
  }

  return {
    payouts,
    gameFee,
  };
};
