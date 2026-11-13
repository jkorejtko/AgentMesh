import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { AsyncMutex } from "./async-mutex.js";

describe("AsyncMutex", () => {
  it("does not execute operations concurrently", async () => {
    const mutex = new AsyncMutex();
    const executionOrder: string[] = [];

    await Promise.all([
      mutex.runExclusive(async () => {
        executionOrder.push("A started");

        await new Promise((resolve) => setTimeout(resolve, 30));

        executionOrder.push("A finished");
      }),
      mutex.runExclusive(async () => {
        executionOrder.push("B started");

        await new Promise((resolve) => setTimeout(resolve, 10));

        executionOrder.push("B finished");
      }),
    ]);

    assert.deepEqual(executionOrder, ["A started", "A finished", "B started", "B finished"]);
  });

  it("releases the lock when an operation throws", async () => {
    const mutex = new AsyncMutex();

    await assert.rejects(
      () =>
        mutex.runExclusive(async () => {
          throw new Error("Test error");
        }),
      /Test error/,
    );

    let secondOperationExecuted = false;

    await mutex.runExclusive(async () => {
      secondOperationExecuted = true;
    });

    assert.equal(secondOperationExecuted, true);
  });
});
