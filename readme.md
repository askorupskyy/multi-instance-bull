# Scaling Bull jobs across multiple Node instances

In this example I am attempting to build a scalable Node.js architecture where an `api` app is scheduling intensive (CPU-heavy or just really long jobs) across multiple instances.
There are also stateless `worker` apps that are deployed separately from the API.

# How it works:

- Number of worker groups = number of queues. This is useful for green-blue deployments when you want to test out some feature in Canary mode.
- The `app-api` schedules the jobs, balancing between the queues in a round-robin fashion, taking into the account the traffic weight preset in the config.
- The fact that all queues is stateful (redis in this case) allows us to leave no job behind and rebalance them efficiently.
- Once all of the workers for a certain group are down my app rebalances the tasks from them into other group's queue.
- In runtime these queues are easy to modify, rebalance, add or remove (in case weights change or a new worker shows up). It can be as simple as running a few redis commands after each deploy.
- Read the rest in `app-api/main.ts`.

# Running:

- `docker compose build`
- `docker compose up` -> fires up 2 worker groups: `green` and `blue` as well as redis.

^ This will allow you to test the load balancer by scheduling a 1000 jobs with an approximate 5-95% distribution between the workers.

# Testing the rebalancing recovery mechanism (in case some worker dies):

- Same as above but kill one of the containers: `docker ps` -> copy the id -> `docker container kill ${id}`
