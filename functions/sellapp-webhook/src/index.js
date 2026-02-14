import { processSellappWebhook } from "./process-webhook.js";

export function createHandler({ env = process.env, fetchImpl = fetch } = {}) {
  return async ({ req, res, log, error }) => {
    try {
      const out = await processSellappWebhook({ req, env, fetchImpl });
      return res.json(out);
    } catch (err) {
      error(err?.message ?? String(err));
      log("sellapp-webhook: internal_error");
      return res.json({ ok: false, error: "internal_error" });
    }
  };
}

export default createHandler();

