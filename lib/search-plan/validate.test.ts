import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkPublisherIntent,
  collectPublisherIntentErrors,
} from "./validate";

describe("checkPublisherIntent", () => {
  it("passes SaaS blog feature query", () => {
    const intent = checkPublisherIntent("indie SaaS blog tool feature");
    assert.equal(intent.passes, true);
    assert.equal(intent.hasStrongSignal, true);
  });

  it("passes gift guide query", () => {
    const intent = checkPublisherIntent("gift guide football fan art print");
    assert.equal(intent.passes, true);
    assert.equal(intent.hasStrongSignal, true);
  });

  it("passes resource listing with enough context", () => {
    const intent = checkPublisherIntent("startup resources curated tools list");
    assert.equal(intent.passes, true);
    assert.equal(intent.hasConditionalSignal, true);
  });

  it("passes directory query with newsletter strong signal", () => {
    const intent = checkPublisherIntent("developer tools directory newsletter");
    assert.equal(intent.passes, true);
    assert.equal(intent.hasStrongSignal, true);
  });

  it("rejects asset-descriptor query with only weak signal", () => {
    const intent = checkPublisherIntent(
      "colour gradient data visualization inspiration",
    );
    assert.equal(intent.passes, false);
    assert.equal(intent.hasWeakSignal, true);
    assert.equal(intent.hasStrongSignal, false);
  });

  it("rejects decor ideas without publisher signal", () => {
    const intent = checkPublisherIntent("football room decor ideas");
    assert.equal(intent.passes, false);
    assert.equal(intent.hasWeakSignal, true);
  });

  it("rejects shopping query without strong signal", () => {
    const errors = collectPublisherIntentErrors(
      "buy cheap football poster",
      "Query 1",
    );
    assert.ok(errors.length >= 1);
    assert.ok(
      errors.some((error) => error.includes("shopping language")),
    );
  });
});
