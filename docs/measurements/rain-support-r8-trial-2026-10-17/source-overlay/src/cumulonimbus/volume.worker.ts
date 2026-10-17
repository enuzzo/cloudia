import { generateVolume } from './volume';
import {buildNarrowCloudMask,type NarrowCloudVolume} from './narrowCloud';
import {extractDensityR8,type DensityR8Packet} from './densityR8';
import {extractSupportR8,type SupportR8Packet} from './supportR8';
self.onmessage = (event: MessageEvent<{size: number; seed: number}>) => {
  try {
    const volume:NarrowCloudVolume&DensityR8Packet&SupportR8Packet = generateVolume(event.data.size, event.data.seed, fraction => self.postMessage({progress: fraction}));
    volume.narrowMask=buildNarrowCloudMask(volume,volume.detail.size);
    volume.densityR8=extractDensityR8(volume);
    volume.supportR8=extractSupportR8(volume.detail);
    self.postMessage({volume}, {transfer: [volume.data.buffer,volume.detail.data.buffer,volume.sunsetLight.buffer,volume.narrowMask.data.buffer,volume.densityR8.data.buffer,volume.supportR8.data.buffer]});
  } catch(error) { self.postMessage({error: error instanceof Error ? error.message : String(error)}); }
};
