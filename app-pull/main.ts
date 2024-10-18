import { Worker } from "bullmq";

const worker = new Worker(
  "pull-queue",
  async (job) => {
    console.log(
      "assigned job >>> ",
      job.data,
      "to instance >>> ",
      process.env.INSTANCE_ID,
    );
  },
  {
    autorun: true,
    connection: {
      url: "redis://:@redis:6379",
    },
  },
);
