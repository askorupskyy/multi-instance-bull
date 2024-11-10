import { Queue } from "bullmq";

import { createBalancer } from "./load-balancer.js";

// suppose this application is an API with a bunch of requests coming in to schedule some tasks.
// we would want to delegate these tasks to some workers because this consumes a bunch of CPU and etc, hence the need for worker nodes.

// here we define the load-balancing configuration between the main app and the workers
// in a production environment this could be achieved via a orchestrator like serf, zookeper, or k8s
// alternatively with old environments this could done by using a separate monitoring/orchestrator node.js app
// (or even a small section of redis memory where all those instances are located)
const CONFIG = {
  CONNECTED_INSTANCES: {
    "worker-blue": { WEIGHT: 5 },
    "worker-green": { WEIGHT: 95 },
  },
};

// for each master-worker relationship we would want a separate queue.
// the queue itself is not a good place to distribute traffic because it assigns a worker randomly
// and therefore this part should be handled separately by us.

// the point of the queue is to keep track of which jobs are assigned and what their state is.
// also in case we have 6 green and 4 blue nodes we can use two queues to equally disctribute traffic across these 2 groups.
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

// instantiate the balancer with available nodes at first runtime.
// for the demo purpose i feel like this is enough
// inside the `balance` callback we can do whatever we want: run healthchecks,
// rebalance the queue if one of the workers is dead or had too many failed jobs, etc.
const balancer = createBalancer(Object.values(CONFIG.CONNECTED_INSTANCES));

// we also want to create a listener for each queues if all of its workers are dead
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
      // pause the queue
      q.pause();

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

      CONFIG.CONNECTED_INSTANCES = {
        ...CONFIG.CONNECTED_INSTANCES,
        [name]: { WEIGHT: 0 },
        [nonDownKey]: {
          WEIGHT:
            CONFIG.CONNECTED_INSTANCES[nonDownKey].WEIGHT + instance.WEIGHT,
        },
      };
      // get the name of the first worker that is not down and assign the rest of the traffic to it...

      console.log(`new balancer cfg ::: `, CONFIG.CONNECTED_INSTANCES);
      const jobs = await q.getJobs();

      balancer.setNodes(Object.values(CONFIG.CONNECTED_INSTANCES));
      balancer.resetTicker();

      for (const j of jobs) {
        const nodeIdx = balancer.balance();
        const q: Queue = queues[Object.keys(queues)[nodeIdx]];
        await q.add(j.name, j.data);
      }

      q.drain();
      q.resume();

      console.log(`rebalancing ${jobs.length} jobs.... done`);
      console.log(`-------------------------`);
    }

    console.log("no rebalancing neeeded....");
  });
}, 5000);

// emulates requests coming in...
async function addJobs() {
  for (let i = 0; i < 1000; i++) {
    // here we obtain the correct node idx.
    const nodeIdx = balancer.balance();
    const q: Queue = queues[Object.keys(queues)[nodeIdx]];
    await q.add("pull", { url: `google.com` });
  }
}

await addJobs();

console.log("jobs added");

// consider following scenarios:
// 1. worker dies: when choosing the next instance upon running `balance()` also run a healthcheck and if the worker is dead ignore it
// ^^^ also we want to pick up the rest of the jobs and populate other queues accordingly.
// call `q.pause()` on other queues, `q.getJobs()`, and then rebalance across the rest of the queues.

// 2. worker shows up: same as ^ pretty much, except we would do the opposite.
// add to the list, pick up some jobs from the rest of the workers and put in the new worker

// why need a queue at all then? how is this different from balancing http requests? ->
// this approach is stateful and guarantees there's no job left behind.
// this allows for minimum job failing % as we would just rebalance if something goes wrong with one of the nodes,
// be that hardware failure, cpu/ram cap or provider or network issue.

// is this the optimal solution? probably not. this is all i could think of on the airplane.
