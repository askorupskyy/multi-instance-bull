# Scaling Bull jobs across multiple Node instances

In this example I am attempting to build a scalable Node.js architecture where a `main` app is scheduling intensive (CPU-heavy or just really long jobs) across multiple instances.

# The architecture

- Redis. This is what we use for messaging.
- We have one `main` app instance. This could be your API or cli, whatever. This app is responsible for scheduling the jobs.
- We have `pull` app instances (in this case 3). These apps connect to the same Redis server as `main` to intercept jobs. Due to Bull's architecture (each job once added, gets an assigned worker), jobs do not repeat or interfere.

# Running:

- `docker compose build`
- `docker compose up`
