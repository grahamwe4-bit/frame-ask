# Frame / ask

Frame / ask is a guest-friendly screenshot viewer with an image-aware ChatGPT conversation in the same tab.

## What it does

- Preview, paste, or drop in a screenshot or photo.
- Zoom, rotate, download, or remove the image.
- Ask a question and see ChatGPT's answer in the Frame / ask panel.
- Continue with follow-up questions about the same image; the conversation stays in browser memory for that tab.
- The image is sent to the backend only when the visitor asks. The page does not save screenshots or conversation history.

## Files

- `index.html` is the GitHub Pages front end.
- `worker.js` is the server-side OpenAI Responses API proxy. It keeps the API key off the public page and accepts image input as a data URL.

## Run the front end locally

This is a standalone static page with no build step or dependencies. Serve the repository root over localhost, for example:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>. The backend permits this local origin for development.

## Backend setup

The Worker needs the runtime secret `OPENAI_API_KEY`. Set it in the hosted backend's environment variables; never put it in `index.html`, GitHub, or a checked-in `.env` file. `OPENAI_MODEL` is optional and defaults to `gpt-4.1-mini`.

OpenAI API requests are billed separately from a ChatGPT subscription. Since Frame / ask is public and offers guest access, requests from visitors use the API account attached to the backend. The Worker caps image size, answer length, and guest request frequency. Its per-IP rate limit is best-effort per Worker isolate rather than durable abuse protection.

The front end calls `https://frame-ask-api.grahamwe4.chatgpt.site/api/ask`. Only the GitHub Pages origin and localhost development origins are accepted by the Worker. OpenAI request storage is disabled with `store: false`; the answer and conversation remain in the visitor's browser tab.
