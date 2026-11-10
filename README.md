# Frame / ask

A small screenshot viewer that helps move an image into ChatGPT.

## What it does

- Preview screenshots and photos from a file, drag and drop, or paste.
- Zoom, rotate, download, and remove the selected image.
- On supported mobile browsers, open the share sheet so you can choose ChatGPT.
- On desktop, copy the image and open ChatGPT in a new tab. Paste with **⌘V** or **Ctrl+V**.
- Keep image handling in the browser; the page has no image upload service or account system.

## Run locally

This is a standalone static page with no build step or dependencies. Serve the folder over localhost, for example:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000> in a browser.
