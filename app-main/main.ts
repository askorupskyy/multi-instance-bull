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
    "pull-worker-1": { TRAFFIC_PERCENTAGE: 20 },
    "pull-worker-2": { TRAFFIC_PERCENTAGE: 10 },
    "pull-worker-3": { TRAFFIC_PERCENTAGE: 70 },
  },
};

// for each master-worker relationship we would want a separate queue.
// the queue itself is not a good place to distribute traffic and thus this part should be handled by us.
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
const balance = createBalancer(
  Object.values(CONFIG.CONNECTED_INSTANCES).map(
    (instance) => instance.TRAFFIC_PERCENTAGE,
  ),
);

// emulates requests coming in...
async function addJobs() {
  for (let i = 0; i < 1000; i++) {
    // here we obtain the correct node idx.
    const nodeIdx = balance();
    const q: Queue = queues[Object.keys(queues)[nodeIdx]];
    await q.add("pull", { url: `google.com` });
  }
}

await addJobs();

console.log("jobs added, dying...");

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
