// accepts an array of distribution percentages. processes everything in a round-robin fashion
export const createBalancer = (distribution: number[]) => {
  let ticker = 0;

  return () => {
    let sum = 0;
    let selectedNode = 0;
    for (let i = 0; i < distribution.length; i++) {
      sum += distribution[i];
      if (ticker < sum) {
        selectedNode = i;
        break;
      }
    }
    ticker++;
    if (ticker > 100) {
      ticker = 0;
    }
    return selectedNode;
  };
};
