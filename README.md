# 🖨️ PrintPerfect

A free tool that helps beginner 3D printing enthusiasts get the right slicer settings for their specific print. Upload your model, tell it about your setup, and get tailored settings with plain-English explanations powered by Claude.

**Live features:**
- Client-side geometry analysis (STL, OBJ, 3MF)
- Rule-based settings engine
- Claude AI explanations for every setting
- Zero file storage — files never leave your browser

---

## Quick Start

### 1. Clone & Install

```bash
git clone <your-repo>
cd print-perfect
npm install
```

### 2. Set up your API key

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your Anthropic API key:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Get a key at [console.anthropic.com](https://console.anthropic.com).

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deploy to Vercel

1. Push the project to GitHub
2. Import the repo at [vercel.com/new](https://vercel.com/new)
3. Add the `ANTHROPIC_API_KEY` environment variable in Vercel's project settings
4. Deploy — that's it

No database, no special Vercel config needed.

---

## Ko-fi Setup

To connect your own Ko-fi tip jar, find this line in `components/ResultsScreen.tsx`:

```tsx
href="https://ko-fi.com/printperfect"
```

Replace `printperfect` with your Ko-fi username.

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14 (App Router) | Vercel-native, API routes for Claude |
| Styling | Tailwind CSS | Rapid utility-first, mobile-friendly |
| File parsing | Custom parsers | No Three.js bloat; handles STL/OBJ/3MF |
| 3MF unzip | fflate | Lightweight client-side ZIP |
| AI | Anthropic SDK (claude-sonnet-4-20250514) | Best reasoning for friendly explanations |
| Icons | Lucide React | Clean, consistent |

---

## Privacy

- Your files are parsed entirely in the browser using the Web APIs
- No file contents are ever sent to our servers
- Only the geometry analysis results (dimensions, overhang stats) are sent to the API route for Claude processing
- No analytics, no tracking, no accounts

---

## Project Structure

```
print-perfect/
├── app/
│   ├── api/recommend/route.ts  ← Claude API call
│   ├── layout.tsx
│   ├── page.tsx                ← App state machine
│   └── globals.css
├── components/
│   ├── UploadScreen.tsx
│   ├── InputForm.tsx
│   ├── ResultsScreen.tsx
│   ├── GeometryVisualizer.tsx
│   └── ProgressIndicator.tsx
└── lib/
    ├── types.ts                ← Shared TypeScript types
    ├── fileParser.ts           ← Client-side STL/OBJ/3MF parser
    └── ruleEngine.ts           ← Settings computation logic
```
