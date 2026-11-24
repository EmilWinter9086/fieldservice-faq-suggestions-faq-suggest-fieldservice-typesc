import test from "node:test";
import assert from "node:assert/strict";
import { chooseSuggestedFaq } from "./faq-suggestion-service.ts";

test("completed work orders with invoice follow-up choose the invoice FAQ", () => {
  const result = chooseSuggestedFaq({
    question: "What happens next?",
    workOrderId: "WO-1042",
    photoCount: 1,
    dispatchStatus: "complete",
    technicianFollowUp: "Please send the invoice"
  }, [
    { id: "photo", text: "How do I attach a work-order photo?" },
    { id: "invoice", text: "Where can I find the service invoice?" }
  ]);
  assert.equal(result?.id, "invoice");
});
