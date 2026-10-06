# Screenora Studio

**Record. Explain. Share.**

Screenora Studio is a lightweight, privacy-first browser recording studio. It captures the screen into a browser canvas, optionally composites a circular webcam overlay, optionally mixes microphone audio with supported system/tab audio, and records the composed stream with `MediaRecorder`.

## Run locally

For browser permission APIs, use `localhost` or an HTTPS host. A simple local server is enough:

```bash
python -m http.server 8080
```

Then open:

`http://localhost:8080`

## Host

This is a static site. Upload `index.html`, `styles.css`, and `app.js` to a static host such as GitHub Pages, Netlify, Vercel, Cloudflare Pages, or similar HTTPS hosting.

## Browser notes

- Screen capture uses `getDisplayMedia()`.
- Camera and microphone use `getUserMedia()`.
- Output is WebM where supported.
- System/tab audio depends on the browser and the selected capture surface.
- The app does not upload recordings to a server.

## Product branding

Name: **Screenora Studio**
Tagline: **Record. Explain. Share.**

The visual system intentionally avoids any existing personal/company branding and uses a neutral creator-tool identity: charcoal, warm white, and a single coral-red recording accent.

## Current scope

Included: screen capture, camera overlay, microphone, supported system audio mixing, countdown, pause/resume, stop, timer, preview, download, camera position/size controls, resolution control, responsive interface, and local-only processing.

Not included yet: automatic MP4 transcoding, direct YouTube OAuth upload, cloud storage, accounts, team collaboration, transcription, or server-side processing.

## Important testing expectation

A downloaded WebM file can be uploaded to YouTube in many workflows, but some platforms/workflows may prefer MP4. Direct in-app YouTube upload would require an authenticated YouTube integration and is intentionally not part of this privacy-first static prototype.
