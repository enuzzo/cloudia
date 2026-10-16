import { generateVolume } from './volume';
import {buildNarrowCloudMask,type NarrowCloudVolume} from './narrowCloud';
self.onmessage = (event: MessageEvent<{size: number; seed: number}>) => {
  try {
    const volume:NarrowCloudVolume = generateVolume(event.data.size, event.data.seed, fraction => self.postMessage({progress: fraction}));
    volume.narrowMask=buildNarrowCloudMask(volume,volume.detail.size);
    self.postMessage({volume}, {transfer: [volume.data.buffer,volume.detail.data.buffer,volume.sunsetLight.buffer,volume.narrowMask.data.buffer]});
  } catch(error) { self.postMessage({error: error instanceof Error ? error.message : String(error)}); }
};
