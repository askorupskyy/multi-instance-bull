// accepts an array of distribution percentages. processes everything in a round-robin fashion
export const createBalancer = (nodes: { WEIGHT: number }[]) => {
  let ticker = 0;
  let _nodes = nodes;

  const balance = () => {
    let sum = 0;
    let selectedNode = 0;
    for (let i = 0; i < _nodes.length; i++) {
      sum += _nodes[i].WEIGHT;
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

  const resetTicker = () => {
    ticker = 0;
  };
  const setNodes = (nodes: { WEIGHT: number }[]) => {
    _nodes = nodes;
  };

  return { _nodes, balance, resetTicker, setNodes };
};
