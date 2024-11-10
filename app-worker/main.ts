import { Worker } from "bullmq";

let processedJobCount = 0;

const worker = new Worker(
  `${process.env.GROUP_ID}-queue`,
  async (job) => {
    await new Promise((res, rej) => {
      setTimeout(() => res("job done"), 500);
    });
    console.log(
      process.env.GROUP_ID + " processed job # " + ++processedJobCount,
    );
  },
  {
    autorun: true,
    connection: {
      url: "redis://:@redis:6379",
    },
  },
);
