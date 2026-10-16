# Root native review — FAIL of the predeclared visual gate

Inspected full native2474×1844 candidate and baseline plus fixed1:1ROI[900,1240,1800,1820], with no resizing. Candidate opens more visible gaps, but those gaps read as elongated dark slots between broad, almost constant vertical gray bands. The remaining shafts retain the flat veil appearance; the bottom crop resembles a row of curtain panels rather than convincing rain depth. This matches the predeclared palisade failure, even though the transformation is not a uniform opacity reduction.

No new cloud or terrain defect is evident in this single matched Rain pose. This does not satisfy the intended rain quality. PASS of439 tests/builds is insufficient to adopt it. Reject this candidate without fitting thresholds/gain after the image. Product stays v59. Stop rule: no worker, drySun, motion or FPS qualification for this candidate after this FAIL. Independent image-only review remains useful to audit this judgment; it does not change the root FAIL gate.

The trial isolates the limitation of changing only a height-constant broad modulator. It does not prove the complete cause of the flat veil or assign all artifacts to rainMap blur. Next implementation must address source/illumination/depth coherence with a separately specified change, not tune this remap to look better in the same pose.
