# Frame / ask

Frame / ask is a guest-friendly screenshot viewer with an image-aware ChatGPT conversation in the same tab.

**Website:** [Open Frame / ask](https://grahamwe4-bit.github.io/frame-ask/)

## Pricing and payment

The test plan is **$15 USD per month** through Stripe Checkout. The public checkout is in Stripe test mode for now, so test card entries do not charge real money. Live billing requires live-mode Stripe configuration.

## What it does

- Preview, paste, or drop in a screenshot or photo.
- Zoom, rotate, download, or remove the image.
- Ask a question and see ChatGPT's answer in the Frame / ask panel.
- Continue with follow-up questions about the same image; the conversation stays in browser memory for that tab.
- The image is sent to the backend only when the visitor asks. The page does not save screenshots or conversation history.
- Guests do not need to create an account; an active monthly subscription unlocks image questions.

## Files

- `index.html` is the GitHub Pages front end.
- `worker.js` and `worker/index.js` contain the backend Worker source. The hosted API is [Frame / ask API](https://frame-ask-api.grahamwe4.chatgpt.site).

## Run the front end locally

This is a standalone static page with no build step. Serve the repository root over localhost, for example:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>. The backend permits this local origin for development.

## Backend settings

Set these values in the hosted backend's runtime environment, never in `index.html`, GitHub, or checked-in files:

- `OPENAI_API_KEY` — secret OpenAI API key used for image questions.
- `STRIPE_SECRET_KEY` — secret Stripe test-mode restricted key for Checkout, subscriptions, invoices, and the customer portal.
- `STRIPE_WEBHOOK_SECRET` — secret signing value for the Stripe webhook.
- `STRIPE_PRICE_ID` — the Stripe monthly price selected for checkout.
- `OPENAI_MODEL` is optional and defaults to `gpt-4.1-mini`.

Stripe subscription payments go to the site's Stripe account. OpenAI API usage is billed separately to the API account owner, so API requests require available API credits. The Worker limits image size, answer length, and guest request frequency. Its per-IP rate limit is best-effort per Worker isolate rather than durable abuse protection.

The front end calls `https://frame-ask-api.grahamwe4.chatgpt.site`. Only the GitHub Pages origin and localhost development origins are accepted by the Worker. OpenAI request storage is disabled with `store: false`; the answer and conversation remain in the visitor's browser tab.

Automatic tax is off because tax registration has not been set up. Review applicable tax obligations before switching billing to live mode.
