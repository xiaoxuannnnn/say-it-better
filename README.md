# Say It Better — V1

Minimal Business English speaking trainer.

## Run locally
```bash
npm install
npm run dev
```

## Deploy to Vercel
Import this repository in Vercel. Framework preset: Vite. Build command: `npm run build`. Output directory: `dist`.

## V1 scope
- 50 curated Business Mode questions (the original archive contains 50; its README previously said 49)
- P&G-style behavioral classics (labeled as style/classics, not claimed as an official fixed eight-question list)
- Marketing / FMCG / Experience / Random categories
- Progressive hints: thinking framework → starter sentence → useful expressions
- Browser speech recognition where supported
- Save expressions to localStorage
- Resume Mode placeholder

## Next API step
Add `/api/feedback` on Vercel to accept transcript + question and return concise corrections. Keep API keys server-side; never expose them in frontend code.
