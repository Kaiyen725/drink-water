import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const SURFACE_GLSL = `
  uniform float uTime;
  uniform float uLevel;
  uniform float uSlosh;
  uniform float uSplashX;
  uniform float uSplashAge;
  uniform float uAspect;

  float waterSurface(float x) {
    float ax = x * uAspect;
    float calm = 0.009 + uSlosh * 0.026;
    float h = uLevel;
    h += sin(ax * 2.6 + uTime * 1.1) * calm;
    h += sin(ax * 4.9 - uTime * 1.7 + 1.3) * calm * 0.6;
    h += sin(ax * 9.3 + uTime * 2.6 + 0.7) * calm * 0.25;
    h += cos(x * 3.14159) * sin(uTime * 2.3) * uSlosh * 0.04;

    float d = abs(x - uSplashX) * uAspect;
    float front = uSplashAge * 0.8;
    float reach = smoothstep(front + 0.08, front - 0.08, d);
    h += sin(d * 20.0 - uSplashAge * 9.0)
      * 0.05 * exp(-uSplashAge * 0.85) * exp(-d * 1.2) * reach;
    return h;
  }
`

const quadVertex = `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const waterFragment = `
  precision highp float;
  out vec4 fragColor;

  uniform vec2 uResolution;
  uniform vec3 uAirHigh;
  uniform vec3 uAirLow;
  uniform vec3 uShallow;
  uniform vec3 uDeep;
  uniform vec3 uLight;
  uniform vec3 uFoam;

  ${SURFACE_GLSL}

  float caustic(vec2 uv, float t) {
    vec2 p = uv * 6.28318 - 250.0;
    vec2 i = p;
    float c = 1.0;
    float inten = 0.005;
    for (int n = 0; n < 4; n++) {
      float tt = t * (1.0 - (3.5 / float(n + 1)));
      i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
      c += 1.0 / length(vec2(
        p.x / (sin(i.x + tt) / inten),
        p.y / (cos(i.y + tt) / inten)
      ));
    }
    c /= 4.0;
    c = 1.17 - pow(c, 1.4);
    return clamp(pow(abs(c), 8.0), 0.0, 1.0);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;
    float px = 1.0 / uResolution.y;
    float surface = waterSurface(uv.x);
    float depth = surface - uv.y;
    float below = max(depth, 0.0);

    vec3 air = mix(uAirLow, uAirHigh, smoothstep(surface, 1.0, uv.y));
    air = mix(air, uShallow, exp(-max(-depth, 0.0) * 38.0) * 0.14);

    vec3 water = mix(uShallow, uDeep, smoothstep(0.0, 0.85, below));
    vec2 cp = vec2(uv.x * uAspect, uv.y) * 0.85;
    water += uLight * caustic(cp, uTime * 0.5) * 0.3 * exp(-below * 2.0);

    float rays = pow(max(0.0, sin(uv.x * uAspect * 7.0 + uv.y * 3.5 + sin(uTime * 0.35) * 1.5)), 6.0);
    rays *= pow(max(0.0, sin(uv.x * uAspect * 3.1 - uv.y * 1.2 - uTime * 0.2)), 2.0);
    water += uLight * rays * 0.14 * exp(-below * 3.0);

    water = mix(water, uLight, exp(-below * 16.0) * 0.2);
    water = mix(water, uFoam, exp(-below / (px * 2.5)) * 0.9);

    float edge = smoothstep(-px, px, depth);
    fragColor = vec4(mix(air, water, edge), 1.0);
  }
`

const bubbleVertex = `
  ${SURFACE_GLSL}
  uniform float uBurst;
  uniform float uPixelRatio;
  in float aSize;
  in float aBurst;
  out float vAlpha;

  void main() {
    float y = fract(position.y + uTime * position.z);
    float x = mix(position.x, uSplashX + (position.x - 0.5) * 0.24, aBurst);
    x += sin(uTime * 1.7 + position.y * 31.0) * 0.006;
    float column = waterSurface(x) - 0.012;
    vAlpha = smoothstep(0.0, 0.1, y)
      * (1.0 - smoothstep(0.88, 1.0, y))
      * mix(0.5, uBurst, aBurst);
    gl_Position = vec4(x * 2.0 - 1.0, y * column * 2.0 - 1.0, 0.0, 1.0);
    gl_PointSize = aSize * uPixelRatio;
  }
`

const bubbleFragment = `
  precision highp float;
  in float vAlpha;
  out vec4 fragColor;
  uniform vec3 uFoam;

  void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float r = length(c);
    if (r > 1.0) discard;
    float ring = smoothstep(0.55, 0.85, r) * (1.0 - smoothstep(0.85, 1.0, r));
    float shine = smoothstep(0.38, 0.0, length(c - vec2(-0.32, 0.32)));
    float alpha = (ring * 0.75 + shine * 0.6) * vAlpha;
    if (alpha < 0.01) discard;
    fragColor = vec4(uFoam, alpha);
  }
`

function palette(dark) {
  if (dark) {
    return {
      airHigh: '#0d1518',
      airLow: '#17252a',
      shallow: '#1b8aa6',
      deep: '#03222d',
      light: '#bdf3ff',
      foam: '#e8f8fb',
    }
  }
  return {
    airHigh: '#e8f0f3',
    airLow: '#c6d9e1',
    shallow: '#3aa6c2',
    deep: '#0b4a63',
    light: '#e9fbff',
    foam: '#ffffff',
  }
}

function buildBubbles() {
  const count = 120
  const positions = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const bursts = new Float32Array(count)
  for (let index = 0; index < count; index += 1) {
    const burst = index < 60 ? 1 : 0
    positions[index * 3] = Math.random()
    positions[index * 3 + 1] = Math.random()
    positions[index * 3 + 2] = burst
      ? 0.3 + Math.random() * 0.35
      : 0.04 + Math.random() * 0.07
    sizes[index] = burst ? 6 + Math.random() * 12 : 3 + Math.random() * 7
    bursts[index] = burst
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geometry.setAttribute('aBurst', new THREE.BufferAttribute(bursts, 1))
  return geometry
}

export default function WaterBackground({ level, splash }) {
  const hostRef = useRef(null)
  const levelRef = useRef(level)
  const splashRef = useRef(splash)
  const renderRef = useRef(null)

  useEffect(() => {
    levelRef.current = level
    renderRef.current?.()
  }, [level])

  useEffect(() => {
    splashRef.current = splash
  }, [splash])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false })
    } catch {
      return
    }

    const scene = new THREE.Scene()
    const camera = new THREE.Camera()

    const shared = {
      uTime: { value: 0 },
      uLevel: { value: 0 },
      uSlosh: { value: 0 },
      uSplashX: { value: 0.5 },
      uSplashAge: { value: 100 },
      uAspect: { value: 1 },
      uFoam: { value: new THREE.Color() },
    }
    const waterUniforms = {
      ...shared,
      uResolution: { value: new THREE.Vector2(1, 1) },
      uAirHigh: { value: new THREE.Color() },
      uAirLow: { value: new THREE.Color() },
      uShallow: { value: new THREE.Color() },
      uDeep: { value: new THREE.Color() },
      uLight: { value: new THREE.Color() },
    }
    const bubbleUniforms = {
      ...shared,
      uBurst: { value: 0 },
      uPixelRatio: { value: 1 },
    }

    const quad = new THREE.PlaneGeometry(2, 2)
    const waterMaterial = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: waterUniforms,
      vertexShader: quadVertex,
      fragmentShader: waterFragment,
      depthTest: false,
      depthWrite: false,
    })
    const water = new THREE.Mesh(quad, waterMaterial)
    water.frustumCulled = false
    scene.add(water)

    const bubbleGeometry = buildBubbles()
    const bubbleMaterial = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: bubbleUniforms,
      vertexShader: bubbleVertex,
      fragmentShader: bubbleFragment,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })
    const bubbles = new THREE.Points(bubbleGeometry, bubbleMaterial)
    bubbles.frustumCulled = false
    bubbles.renderOrder = 1
    scene.add(bubbles)

    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)')
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')

    const applyPalette = () => {
      const colors = palette(colorScheme.matches)
      const set = (uniform, hex) =>
        uniform.value.setStyle(hex, THREE.LinearSRGBColorSpace)
      set(waterUniforms.uAirHigh, colors.airHigh)
      set(waterUniforms.uAirLow, colors.airLow)
      set(waterUniforms.uShallow, colors.shallow)
      set(waterUniforms.uDeep, colors.deep)
      set(waterUniforms.uLight, colors.light)
      set(shared.uFoam, colors.foam)
    }

    const resize = () => {
      const width = host.clientWidth || window.innerWidth
      const height = host.clientHeight || window.innerHeight
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5)
      renderer.setPixelRatio(ratio)
      renderer.setSize(width, height, false)
      waterUniforms.uResolution.value.set(width * ratio, height * ratio)
      shared.uAspect.value = width / Math.max(height, 1)
      bubbleUniforms.uPixelRatio.value = ratio
    }

    renderer.domElement.className = 'block h-full w-full'
    host.appendChild(renderer.domElement)
    applyPalette()
    resize()

    const started = performance.now()
    let shown = motion.matches ? levelRef.current : 0
    let velocity = 0
    let slosh = motion.matches ? 0 : 0.7
    let lastFrame = started
    let seenSplash = splashRef.current?.id ?? null
    let splashAt = null

    const renderFrame = (now) => {
      const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000))
      lastFrame = now
      const target = levelRef.current

      const pending = splashRef.current
      if (pending && pending.id !== seenSplash) {
        seenSplash = pending.id
        if (!motion.matches) {
          splashAt = now
          slosh = 1
          shared.uSplashX.value = pending.x
        }
      }

      if (motion.matches) {
        shown = target
        velocity = 0
        slosh = 0
        splashAt = null
      } else {
        const accel = (target - shown) * 6.5 - velocity * 3.1
        velocity += accel * dt
        shown += velocity * dt
        slosh *= Math.exp(-dt * 0.9)
      }

      const age = splashAt == null ? 100 : (now - splashAt) / 1000
      shared.uTime.value = motion.matches ? 0 : (now - started) / 1000
      shared.uLevel.value = shown
      shared.uSlosh.value = slosh
      shared.uSplashAge.value = age
      bubbleUniforms.uBurst.value = splashAt == null ? 0 : Math.exp(-age * 0.55)
      renderer.render(scene, camera)
    }

    const startLoop = () => {
      lastFrame = performance.now()
      if (motion.matches || document.hidden) {
        renderer.setAnimationLoop(null)
        renderFrame(performance.now())
        return
      }
      renderer.setAnimationLoop(renderFrame)
    }

    renderRef.current = () => {
      if (motion.matches) renderFrame(performance.now())
    }

    const onColor = () => {
      applyPalette()
      renderRef.current?.()
    }

    colorScheme.addEventListener('change', onColor)
    motion.addEventListener('change', startLoop)
    document.addEventListener('visibilitychange', startLoop)
    window.addEventListener('resize', resize)
    startLoop()

    return () => {
      renderRef.current = null
      colorScheme.removeEventListener('change', onColor)
      motion.removeEventListener('change', startLoop)
      document.removeEventListener('visibilitychange', startLoop)
      window.removeEventListener('resize', resize)
      renderer.setAnimationLoop(null)
      quad.dispose()
      waterMaterial.dispose()
      bubbleGeometry.dispose()
      bubbleMaterial.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [])

  return (
    <div
      ref={hostRef}
      className="pointer-events-none absolute inset-0 z-0 bg-dry"
      aria-hidden="true"
    />
  )
}
