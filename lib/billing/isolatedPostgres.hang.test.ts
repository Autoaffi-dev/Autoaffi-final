import { it } from "node:test";

it("stays running until the parent stops it", () => {
  setInterval(() => undefined, 1_000);
  return new Promise(() => undefined);
});
