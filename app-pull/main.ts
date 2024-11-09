import { Worker } from "bullmq";

let processedJobCount = 0;

const worker = new Worker(
  `${process.env.INSTANCE_ID}-queue`,
  async (job) => {
    console.log(
      "worker" +
        process.env.INSTANCE_ID +
        "processed job # " +
        ++processedJobCount,
    );
  },
  {
    autorun: true,
    connection: {
      url: "redis://:@redis:6379",
    },
  },
);
