import { processSellappWebhook } from "./process-webhook.js";

export function createHandler({ env = process.env, fetchImpl = fetch } = {}) {
  return async ({ req, res, log, error }) => {
    try {
      const out = await processSellappWebhook({ req, env, fetchImpl });
      return res.json(out);
    } catch (err) {
      const msg = err?.message ?? String(err);
      // Log details for debugging in Appwrite Console without leaking secrets.
      // This is critical when network/TLS/DNS issues happen inside the function runtime.
      log(`sellapp-webhook: internal_error: ${msg}`);
      if (err?.status) log(`sellapp-webhook: internal_error_status: ${err.status}`);
      if (err?.response?.type) log(`sellapp-webhook: internal_error_type: ${err.response.type}`);
      error(msg);
      return res.json({ ok: false, error: "internal_error" });
    }
  };
}

export default createHandler();
