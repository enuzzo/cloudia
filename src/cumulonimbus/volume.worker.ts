import { generateVolume } from './volume';
import {buildNarrowCloudMask,type NarrowCloudVolume} from './narrowCloud';
import {extractDensityR8,type DensityR8Packet} from './densityR8';
self.onmessage = (event: MessageEvent<{size: number; seed: number}>) => {
  try {
    const volume:NarrowCloudVolume&DensityR8Packet = generateVolume(event.data.size, event.data.seed, fraction => self.postMessage({progress: fraction}));
    volume.narrowMask=buildNarrowCloudMask(volume,volume.detail.size);
    volume.densityR8=extractDensityR8(volume);
    self.postMessage({volume}, {transfer: [volume.data.buffer,volume.detail.data.buffer,volume.sunsetLight.buffer,volume.narrowMask.data.buffer,volume.densityR8.data.buffer]});
  } catch(error) { self.postMessage({error: error instanceof Error ? error.message : String(error)}); }
};
