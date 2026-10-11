import { generateVolume } from './volume';
self.onmessage = (event: MessageEvent<{size: number; seed: number}>) => {
  try {
    const volume = generateVolume(event.data.size, event.data.seed, fraction => self.postMessage({progress: fraction}));
    self.postMessage({volume}, {transfer: [volume.data.buffer]});
  } catch(error) { self.postMessage({error: error instanceof Error ? error.message : String(error)}); }
};
