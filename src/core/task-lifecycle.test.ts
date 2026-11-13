import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { canTransition, assertTransition } from "./task-lifecycle.js";

describe("Task lifecycle", () => {
  it("allows pending task to become ready", () => {
    assert.equal(canTransition("pending", "ready"), true);
  });

  it("allows ready task to be delegated", () => {
    assert.equal(canTransition("ready", "delegating"), true);
  });

  it("allows running task to complete", () => {
    assert.equal(canTransition("running", "completed"), true);
  });

  it("allows retry after execution failure", () => {
    assert.equal(canTransition("running", "pending"), true);
  });

  it("does not allow completed task to restart", () => {
    assert.equal(canTransition("completed", "pending"), false);
  });

  it("does not allow pending task to complete directly", () => {
    assert.equal(canTransition("pending", "completed"), false);
  });

  it("throws on invalid transition", () => {
    assert.throws(() => assertTransition("completed", "running"), /Invalid task transition/);
  });
});
