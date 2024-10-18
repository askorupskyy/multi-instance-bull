import { Queue } from "bullmq";

const pullQueue = new Queue("pull-queue", {
  connection: {
    url: "redis://:@redis:6379",
  },
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
  },
});

async function addJobs() {
  for (let i = 0; i < 1000; i++) {
    await pullQueue.add("pull", { url: "google.com" });
  }
}

await addJobs();

console.log("jobs added");

while (true) {}
