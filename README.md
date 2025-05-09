# Voice Activity Indicator
## Features

- Audio visualization component that responds to microphone input or audio playback
- Real-time visualization of audio levels
- Support for multiple audio tracks
- Responsive design using shadcn/ui components

## Getting Started

First, place your audio files in the `/public/audio` directory:
- gardens.mp3
- kugelsicher.mp3
- spinning-head.mp3

Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Visit [http://localhost:3000/audio](http://localhost:3000/audio) to see the audio visualizer.

## Dependencies

This project uses:
- Next.js for the React framework
- shadcn/ui for the component library
- motion for animations
- Web Audio API for audio processing
