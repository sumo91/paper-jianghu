import assert from "node:assert/strict";
import test from "node:test";
import { NARRATIVE_ENABLED } from "../src/ui/features.ts";
import { TABS } from "../src/ui/tabs.ts";

test("idle-first phase hides narrative surfaces behind the feature flag", () => {
  assert.equal(NARRATIVE_ENABLED, false);
  const ids = TABS.map((tab) => tab.id);
  assert.deepEqual(ids, ["map", "character", "martial", "bag"]);
  assert.equal(ids.includes("jianghu" as never), false);
});
