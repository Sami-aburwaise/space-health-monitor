/**
 * Play a TTS blob through a "space radio" chain and sync mouth pulses to real amplitude.
 * Animation must not start until `onStart` — after decode + graph is running.
 */
export interface RadioPlayHandles {
  stop: () => void
}

export async function playRadioVoice(
  blob: Blob,
  opts: {
    onStart?: () => void
    onEnd?: () => void
    /** Per-frame speech loudness, 0 (silence) to 1 (syllable peak) */
    onLevel?: (level: number) => void
    signal?: AbortSignal
  } = {},
): Promise<RadioPlayHandles> {
  const ctx = new AudioContext()
  const arrayBuf = await blob.arrayBuffer()
  if (opts.signal?.aborted) {
    await ctx.close()
    throw new DOMException('Aborted', 'AbortError')
  }

  const buffer = await ctx.decodeAudioData(arrayBuf.slice(0))
  if (opts.signal?.aborted) {
    await ctx.close()
    throw new DOMException('Aborted', 'AbortError')
  }

  if (ctx.state === 'suspended') await ctx.resume()

  const source = ctx.createBufferSource()
  source.buffer = buffer
  // Slightly faster + higher pitch for an energetic coach
  source.playbackRate.value = 1.08

  const highpass = ctx.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.value = 280
  highpass.Q.value = 0.7

  const bandpass = ctx.createBiquadFilter()
  bandpass.type = 'bandpass'
  bandpass.frequency.value = 1800
  bandpass.Q.value = 0.85

  const peaking = ctx.createBiquadFilter()
  peaking.type = 'peaking'
  peaking.frequency.value = 3200
  peaking.Q.value = 1.2
  peaking.gain.value = 6

  const shaper = ctx.createWaveShaper()
  shaper.curve = makeDriveCurve(12) as Float32Array<ArrayBuffer>
  shaper.oversample = '2x'

  const compressor = ctx.createDynamicsCompressor()
  compressor.threshold.value = -24
  compressor.knee.value = 18
  compressor.ratio.value = 8
  compressor.attack.value = 0.003
  compressor.release.value = 0.12

  const wet = ctx.createGain()
  wet.gain.value = 0.92

  const dry = ctx.createGain()
  dry.gain.value = 0.18

  const master = ctx.createGain()
  master.gain.value = 1.05

  const analyser = ctx.createAnalyser()
  analyser.fftSize = 256
  analyser.smoothingTimeConstant = 0.35

  // Dry path (clarity) + wet radio path
  source.connect(dry)
  dry.connect(master)

  source.connect(highpass)
  highpass.connect(bandpass)
  bandpass.connect(peaking)
  peaking.connect(shaper)
  shaper.connect(compressor)
  compressor.connect(wet)
  wet.connect(master)

  master.connect(analyser)
  analyser.connect(ctx.destination)

  const data = new Float32Array(analyser.fftSize)
  let raf = 0
  let started = false
  let stopped = false
  let peak = 0.05

  const tick = () => {
    if (stopped) return
    analyser.getFloatTimeDomainData(data)
    let sum = 0
    for (let i = 0; i < data.length; i++) sum += (data[i] ?? 0) ** 2
    const rms = Math.sqrt(sum / data.length)
    // Normalize against a slowly decaying peak so syllable gaps read as closed
    // even though the compressor keeps overall loudness flat.
    peak = Math.max(rms, peak * 0.997, 0.02)
    const level = Math.min(1, Math.max(0, (rms / peak - 0.3) / 0.7))
    opts.onLevel?.(level)
    raf = requestAnimationFrame(tick)
  }

  const stop = () => {
    if (stopped) return
    stopped = true
    cancelAnimationFrame(raf)
    try {
      source.stop()
    } catch {
      /* already stopped */
    }
    void ctx.close()
  }

  opts.signal?.addEventListener('abort', stop, { once: true })

  source.onended = () => {
    if (stopped) return
    stopped = true
    cancelAnimationFrame(raf)
    void ctx.close()
    opts.onEnd?.()
  }

  source.start(0)
  started = true
  raf = requestAnimationFrame(tick)
  opts.onStart?.()

  return {
    stop: () => {
      if (!started) return
      stop()
    },
  }
}

function makeDriveCurve(amount: number): Float32Array {
  const n = 256
  const curve = new Float32Array(n)
  const k = amount
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x))
  }
  return curve
}
