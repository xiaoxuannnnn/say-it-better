# Say It Better

Minimal business English speaking practice with live captions, STAR review and résumé questions.

## Run and verify

```sh
npm ci
npm test
npm run dev
npm run build
```

`npm run dev` serves the frontend. Use `vercel dev` for the `/api/practice` serverless endpoint, or test on Vercel. Without an AI service the UI clearly labels the local keyword/template mode.

## Practice flow

- All 50 original questions are retained. Marketing includes General Marketing (14) and Marketing-FMCG (9). P&G-style, Experience and Business Topics are the other categories.
- Browser SpeechRecognition supplies live final/interim captions in English or Chinese. Stop automatically organizes the captured answer; users may edit the transcript and retry. Switching questions aborts recognition and pending STAR requests. Browser support and recognition network availability vary; typing remains available.
- STAR = Situation → Task → Action → Result. Local mode sorts original sentences by keywords, preserves unmatched text and flags missing sections. AI mode rewrites only supported facts and explicitly asks for missing information. Hypothetical questions retain hypothetical framing.
- Resume Mode accepts selectable-text PDF (up to 12 pages), DOCX and TXT, max 5 MB / 18,000 characters, or pasted text. File parsing runs in the browser, with no HTML injection. Scanned PDFs require text pasted separately. Résumés stay in memory only. Local templates quote the experience; AI questions are validated against exact résumé excerpts.
- Saved expressions stay in localStorage. Practice history automatically stores question, quoted résumé excerpt (if applicable), answer and STAR results in this browser. It does not store full résumés or audio and does not sync across devices. Clearing browser data removes history. Each new recording or question starts a new attempt; editing or AI completion updates the same attempt. The history page supports review and per-record deletion.

## Enable OpenAI

In Vercel project Settings → Environment Variables, add `OPENAI_API_KEY` for Production and redeploy. Optional `AI_MODEL` defaults to `gpt-4.1-mini`. Never use a `VITE_` prefix for secrets. `.env.example` documents the server configuration; `.env.local` is excluded from Git.

The UI asks users to enable AI processing before sending confirmed résumé text or answers. Raw files are never sent to the model. API requests set `store: false`; the application does not log payloads. Review provider retention terms separately.

`GET /api/practice` exposes availability only. POST accepts `star` or `resume`, validates lengths, checks same-origin browser requests, enforces a per-instance 6 requests/minute burst limit, and validates model output. This is not a global quota: configure Vercel Firewall rate limits and provider spend limits before wider public use.

Vercel builds with `npm ci` and `npm run build`; frontend output is `dist`. The serverless function has a 60-second maximum and a 45-second upstream timeout.

## Validation

`npm test` covers category preservation, final/interim transcript replacement, speech stop/cancel/permission errors, missing STAR facts, quoted résumé sources, saved-data corruption, request/output validation and mocked AI responses. Real microphone accuracy and model output require the user's browser and an active API key.

PDF/DOCX browser parsing uses `pdfjs-dist` and Mammoth's raw-text browser bundle, loaded only when needed. Mammoth's CLI-only argparse/sprintf dependency currently has an npm audit advisory; this app does not invoke its CLI or include argparse in the browser extraction path.

Polished answers are displayed as four labeled STAR sections, using the exact polished section text returned by the model. Server-side `rewritten` is assembled from those sections to prevent a mismatch between the labeled view and the full answer.
