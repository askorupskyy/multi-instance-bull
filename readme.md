# Scaling Bull jobs across multiple Node instances

In this example I am attempting to build a scalable Node.js architecture where an `api` app is scheduling intensive (CPU-heavy or just really long jobs) across multiple instances.
There are also stateless `worker` apps that are deployed separately from the API.

# The architecture:

- Number of workers = number of queues. The `app-api` schedules the jobs, balancing between the queues in a round-robin fashion, taking into the account the traffic weight preset in the config.
- The fact that all workers is stateful (redis in this case) allows us to leave no job behind.
- Once all of the workers for a certain queue are down we can rebalance the tasks from them into other queues.

# Running:

- `docker compose build`
- `docker compose up`

^ This will allow you to test the load balancer.

# Testing the rebalancing recovery mechanism (in case some worker dies):

- Same as above but kill one of the containers: `docker ps` -> copy the id -> `docker container kill ${id}`
