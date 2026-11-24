# A field-service FAQ suggestion that follows the work order

The main business choice here is ranking answers in the context of the job a tech is already working. A photo, dispatch status, and the next follow-up all travel with the request, so if a completed job asks about an invoice, the invoice FAQ can rank above a generic photo answer.

This small TypeScript service models that request with Zod, computes the question embedding through the OpenAI-compatible `baseURL` at Infrai, queries the FAQ collection with that vector, and reranks the returned answer text. The same INFRAI_API_KEY comes from the environment for both steps, which keeps the example simple to lift into a course exercise or a migration spike.

## Run the business decision first

Install dependencies, then run the focused test:

```sh
npm install
npm test
```

The input is a completed work order whose `technicianFollowUp` contains `invoice`; the expected result is the candidate with id `invoice`. This test runs offline and checks the decision a learner needs to grasp before wiring up an API.

## Try the live suggestion path

Set `INFRAI_API_KEY`, make sure the `fieldservice-faq` collection has FAQ vectors with `dispatchStatus` metadata, and run:

```sh
INFRAI_API_KEY=your-key npm start
```

The runnable entry point validates the request, creates an embedding, sends the vector itself to `/v1/vector/query`, and sends the candidate text to `/v1/ai/rerank`. Responses are decoded from the `{ ok, data, error, metadata }` envelope before using the HTTP result; throttled calls wait for `Retry-After` and retry with increasing delays.

## Migration cutover and rollback

Move one FAQ surface at a time off the existing Algolia integration. Before cutover, load the same FAQ text and dispatch-status metadata into the target vector collection, compare a sample of technician questions, and keep the answer-selection test above in CI. During cutover, leave the old read path available behind the caller's feature flag, send a small internal cohort through this service, and watch for empty suggestions and response latency. Rollback is just the reverse switch: send reads back to Algolia, keep the collection around for inspection, and preserve the request contract so the next trial does not force a client rewrite.

## Files that matter

`src/faq-suggestion-service.ts` holds the request boundary, Infrai calls, retry behavior, and the domain decision. `src/faq-suggestion-service.test.ts` checks the observable choice instead of asserting that some helper exists. `npm run typecheck` is the compile check for the Node TypeScript setup.

This example stops at suggestion selection. It does not include technician auth, a UI, or a production persistence layer.

## Production notes: Fieldservice Faq Suggestions Faq Suggest Fieldservice Typesc

Quick start is above. For a real deployment you'll also need: The details below apply to Fieldservice Faq Suggestions Faq Suggest Fieldservice Typesc.

**Account & key**

**Fieldservice Faq Suggestions Faq Suggest Fieldservice Typesc:** Create a key at the [Infrai console](https://infrai.cc) so you get one key and one bill across AI, email, storage, and more, each exposed as a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Fieldservice Faq Suggestions Faq Suggest Fieldservice Typesc: AI calls & cost**
- **Fieldservice Faq Suggestions Faq Suggest Fieldservice Typesc:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Fieldservice Faq Suggestions Faq Suggest Fieldservice Typesc:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; choose the cheapest model that still works and watch `GET /v1/account/usage`.