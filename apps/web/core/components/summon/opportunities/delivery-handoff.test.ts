import assert from "node:assert/strict";
import test from "node:test";
const { deliveryHandoffState, linkableDeliveryProjects, opportunityCreateHref, opportunityCreateIntent } =
  (await import(new URL("./delivery-handoff.ts", import.meta.url).href)) as typeof import("./delivery-handoff");

const project = { id: "p1", identifier: "DEL", name: "Delivery" };

test("won, client-linked opportunities are ready and nothing starts on stage change alone", () => {
  assert.deepEqual(deliveryHandoffState({ stage: "won", client: "c1", delivery_project: null }), { kind: "ready" });
  assert.deepEqual(deliveryHandoffState({ stage: "negotiation", client: "c1", delivery_project: null }), {
    kind: "not_won",
  });
  assert.deepEqual(deliveryHandoffState({ stage: "won", client: null, delivery_project: null }), {
    kind: "needs_client",
  });
});

test("a linked delivery project stays visible after the stage is corrected", () => {
  assert.deepEqual(deliveryHandoffState({ stage: "lost", client: null, delivery_project: project }), {
    kind: "linked",
    project,
  });
});

test("only active projects the viewer administers can be linked", () => {
  assert.deepEqual(
    linkableDeliveryProjects([
      { ...project, id: "member", name: "Member", member_role: 15, archived_at: null },
      { ...project, id: "archived", name: "Archived", member_role: 20, archived_at: "2026-09-01" },
      undefined,
      { ...project, id: "zeta", name: "Zeta", member_role: 20, archived_at: null },
      { ...project, id: "alpha", name: "Alpha", member_role: 20, archived_at: null },
    ]),
    [
      { id: "alpha", identifier: "DEL", name: "Alpha" },
      { id: "zeta", identifier: "DEL", name: "Zeta" },
    ]
  );
});

test("client detail opens New opportunity with that client preselected", () => {
  const href = opportunityCreateHref("acme", "client-1");
  assert.equal(href, "/acme/summon/opportunities/?create=1&client=client-1");
  assert.deepEqual(opportunityCreateIntent(new URL(href, "https://summon.test").searchParams), {
    open: true,
    client: "client-1",
  });
  assert.deepEqual(opportunityCreateIntent(new URLSearchParams()), { open: false, client: "" });
});
