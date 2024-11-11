import { Queue } from "bullmq";

import { createBalancer } from "./load-balancer.js";

// here we define the load-balancing configuration between the main app and the workers
// in a production environment this could be achieved via a orchestrator
const CONFIG = {
  CONNECTED_INSTANCES: {
    "worker-blue": { WEIGHT: 5 },
    "worker-green": { WEIGHT: 95 },
  },
};

// granted you want to keep track of what is processed by each worker group (green or blue),
// you'd want to keep the queue stateful. in this case i used redis.
// also, bull does not have a neat way of weight-based balancing between the workers, so i created a queue for each of the workers.
const queues = Object.keys(CONFIG.CONNECTED_INSTANCES).reduce<
  Partial<Record<keyof (typeof CONFIG)["CONNECTED_INSTANCES"], Queue>>
>(
  (prev, instanceId) => ({
    ...prev,
    [instanceId]: new Queue(`${instanceId}-queue`, {
      connection: { url: "redis://:@redis:6379" },
    }),
  }),
  {},
);

// NOTE: the above approach does not really require the separation of the `api-worker` like i did here.
// your API app could also serve as a worker with a proper setup.

// instantiate the balancer with available nodes at first runtime.
// for the demo purpose i feel like this is more than enough.
const balancer = createBalancer(Object.values(CONFIG.CONNECTED_INSTANCES));

// we also want to create a listener for each queues to check if all of its workers are dead.
// if that's the case we want to rebalance the workload to the group that is still alive.
setInterval(() => {
  Object.keys(CONFIG.CONNECTED_INSTANCES).forEach(async (name) => {
    const instance =
      CONFIG.CONNECTED_INSTANCES[
        name as keyof typeof CONFIG.CONNECTED_INSTANCES
      ];

    const q = queues[name as keyof typeof queues];
    if (!q) return;

    // does not need rebalancing if it's already zero
    if ((await q.getWorkersCount()) === 0 && instance.WEIGHT !== 0) {
      console.log(`-------------------------`);
      console.log(`rebalancing queue ${name}`);
      // pause the queue so that it does not process any other jobs while we rebalance it....
      q.pause();

      // find the first queue that is not dead.
      let nonDownKey: keyof typeof CONFIG.CONNECTED_INSTANCES | null = null;
      for (const key of Object.keys(CONFIG.CONNECTED_INSTANCES)) {
        if (key === name || CONFIG.CONNECTED_INSTANCES[key].WEIGHT === 0) {
          continue;
        }

        nonDownKey = key as keyof typeof CONFIG.CONNECTED_INSTANCES;
      }

      if (nonDownKey === null) {
        console.log(`all nodes are down, we cannot rebalance`);
        return;
      }

      // redistribute the config
      // get the name of the first worker that is not down and assign the rest of the traffic to it...
      CONFIG.CONNECTED_INSTANCES = {
        ...CONFIG.CONNECTED_INSTANCES,
        [name]: { WEIGHT: 0 },
        [nonDownKey]: {
          WEIGHT:
            CONFIG.CONNECTED_INSTANCES[nonDownKey].WEIGHT + instance.WEIGHT,
        },
      };

      console.log(`new balancer cfg ::: `, CONFIG.CONNECTED_INSTANCES);
      const jobs = await q.getJobs(["waiting", "delayed", "paused"]);

      balancer.setNodes(Object.values(CONFIG.CONNECTED_INSTANCES));
      balancer.resetTicker();

      for (const j of jobs) {
        const nodeIdx = balancer.balance();
        const balancedLiveQueue: Queue = queues[Object.keys(queues)[nodeIdx]];
        await balancedLiveQueue.add(j.name, j.data);
      }

      q.drain();
      q.resume();

      console.log(`rebalancing ${jobs.length} jobs.... done`);
      console.log(`-------------------------`);
    }
  });
}, 5000);

// emulates requests coming in...
async function addJobs() {
  for (let i = 0; i < 1000; i++) {
    // here we obtain the correct node idx.
    const nodeIdx = balancer.balance();
    console.log(nodeIdx);
    const q: Queue = queues[Object.keys(queues)[nodeIdx]];
    await q.add("pull", { url: `google.com` });
  }
}

await addJobs();

console.log("jobs added");
