# Custom Wordle

Make a Wordle with your own secret word and send the link to friends.

1. Type a word (3–10 letters) on the home page.
2. Copy the generated link and share it.
3. Friends get 6 guesses, standard Wordle colours, and a shareable emoji result grid.

The word is lightly obfuscated in the `?w=` query parameter so it isn't readable at a glance.

## Development

```bash
npm install
npm run dev
```

Built with Vite + React, deployed on Vercel.
