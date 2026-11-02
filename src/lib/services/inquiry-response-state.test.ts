import assert from "node:assert/strict";
import { test } from "node:test";
import { getInquiryResponseState } from "./inquiry-response-state";

const now = Date.parse("2026-10-19T12:00:00.000Z");

test("marks a customer message as awaiting publisher response", () => {
  const result = getInquiryResponseState({
    status: "contacted",
    seekerId: "customer-1",
    createdAt: "2026-10-19T10:00:00.000Z",
    latestMessage: {
      senderId: "customer-1",
      senderRole: "buyer",
      createdAt: "2026-10-19T11:00:00.000Z",
    },
  }, now);

  assert.deepEqual(result, {
    waitingForAdvertiser: true,
    waitingSince: "2026-10-19T11:00:00.000Z",
    responseOverdue: false,
  });
});

test("flags a customer message unanswered for 24 hours", () => {
  const result = getInquiryResponseState({
    status: "new",
    seekerId: "customer-1",
    createdAt: "2026-10-18T11:59:59.000Z",
    latestMessage: {
      senderId: "customer-1",
      senderRole: "buyer",
      createdAt: "2026-10-18T11:59:59.000Z",
    },
  }, now);

  assert.equal(result.waitingForAdvertiser, true);
  assert.equal(result.responseOverdue, true);
});

test("does not flag advertiser replies or closed conversations", () => {
  const advertiserReply = getInquiryResponseState({
    status: "contacted",
    seekerId: "customer-1",
    createdAt: "2026-10-18T00:00:00.000Z",
    latestMessage: {
      senderId: "publisher-1",
      senderRole: "owner",
      createdAt: "2026-10-18T11:00:00.000Z",
    },
  }, now);
  const closedInquiry = getInquiryResponseState({
    status: "closed",
    seekerId: "customer-1",
    createdAt: "2026-10-18T00:00:00.000Z",
  }, now);

  assert.equal(advertiserReply.waitingForAdvertiser, false);
  assert.equal(closedInquiry.waitingForAdvertiser, false);
});
