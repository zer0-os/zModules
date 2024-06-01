
export const getPayouts = ({
  playerCount,
  matchFee,
  gameFeeBase,
} : {
  playerCount : bigint;
  matchFee : bigint;
  gameFeeBase : bigint;
}) => {
  const totalPayoutRef = matchFee * playerCount - gameFeeBase;
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

  const gameFeeTotal = gameFeeBase + (totalPayoutRef - totalPayout);

  return {
    payouts,
    gameFee: gameFeeTotal,
  };
};
