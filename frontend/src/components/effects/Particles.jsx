import { useEffect, useRef } from 'react';
import { Camera, Geometry, Mesh, Program, Renderer } from 'ogl';

const defaultColors = ['#ffffff'];

function hexToRgb(hex) {
  const value = hex.replace(/^#/, '');
  const normalized = value.length === 3 ? value.split('').map((character) => character + character).join('') : value;
  const integer = Number.parseInt(normalized.slice(0, 6), 16);
  return [((integer >> 16) & 255) / 255, ((integer >> 8) & 255) / 255, (integer & 255) / 255];
}

const vertex = `
  attribute vec3 position;
  attribute vec4 random;
  attribute vec3 color;
  uniform mat4 modelMatrix;
  uniform mat4 viewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uTime;
  uniform float uSpread;
  uniform float uBaseSize;
  uniform float uSizeRandomness;
  varying vec4 vRandom;
  varying vec3 vColor;

  void main() {
    vRandom = random;
    vColor = color;
    vec3 pos = position * uSpread;
    pos.z *= 10.0;
    vec4 mPos = modelMatrix * vec4(pos, 1.0);
    float t = uTime;
    mPos.x += sin(t * random.z + 6.28 * random.w) * mix(0.1, 1.5, random.x);
    mPos.y += sin(t * random.y + 6.28 * random.x) * mix(0.1, 1.5, random.w);
    mPos.z += sin(t * random.w + 6.28 * random.y) * mix(0.1, 1.5, random.z);
    vec4 mvPos = viewMatrix * mPos;
    gl_PointSize = uSizeRandomness == 0.0
      ? uBaseSize
      : (uBaseSize * (1.0 + uSizeRandomness * (random.x - 0.5))) / length(mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const fragment = `
  precision highp float;
  uniform float uTime;
  uniform float uAlphaParticles;
  varying vec4 vRandom;
  varying vec3 vColor;

  void main() {
    vec2 uv = gl_PointCoord.xy;
    float d = length(uv - vec2(0.5));
    if (uAlphaParticles < 0.5) {
      if (d > 0.5) discard;
      gl_FragColor = vec4(vColor + 0.2 * sin(uv.yxx + uTime + vRandom.y * 6.28), 1.0);
    } else {
      float circle = smoothstep(0.5, 0.4, d) * 0.8;
      gl_FragColor = vec4(vColor + 0.2 * sin(uv.yxx + uTime + vRandom.y * 6.28), circle);
    }
  }
`;

// Adapted from React Bits Particles (MIT + Commons Clause).
export default function Particles({
  particleCount = 200,
  particleSpread = 10,
  speed = 0.1,
  particleColors,
  moveParticlesOnHover = false,
  particleHoverFactor = 1,
  alphaParticles = false,
  particleBaseSize = 100,
  sizeRandomness = 1,
  cameraDistance = 20,
  disableRotation = false,
  pixelRatio = 1,
  className = '',
}) {
  const containerRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const renderer = new Renderer({ dpr: Math.min(pixelRatio, 1.5), depth: false, alpha: true });
    const { gl } = renderer;
    gl.clearColor(0, 0, 0, 0);
    gl.canvas.setAttribute('aria-hidden', 'true');
    container.appendChild(gl.canvas);

    const camera = new Camera(gl, { fov: 15 });
    camera.position.set(0, 0, cameraDistance);

    const resize = () => {
      renderer.setSize(container.clientWidth, container.clientHeight);
      camera.perspective({ aspect: gl.canvas.width / gl.canvas.height });
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    const handleMouseMove = (event) => {
      const rect = container.getBoundingClientRect();
      mouseRef.current = {
        x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
        y: -(((event.clientY - rect.top) / rect.height) * 2 - 1),
      };
    };
    if (moveParticlesOnHover) container.addEventListener('mousemove', handleMouseMove);

    const positions = new Float32Array(particleCount * 3);
    const randoms = new Float32Array(particleCount * 4);
    const colors = new Float32Array(particleCount * 3);
    const palette = particleColors?.length ? particleColors : defaultColors;

    for (let index = 0; index < particleCount; index += 1) {
      let x; let y; let z; let length;
      do {
        x = Math.random() * 2 - 1;
        y = Math.random() * 2 - 1;
        z = Math.random() * 2 - 1;
        length = x * x + y * y + z * z;
      } while (length > 1 || length === 0);
      const radius = Math.cbrt(Math.random());
      positions.set([x * radius, y * radius, z * radius], index * 3);
      randoms.set([Math.random(), Math.random(), Math.random(), Math.random()], index * 4);
      colors.set(hexToRgb(palette[Math.floor(Math.random() * palette.length)]), index * 3);
    }

    const geometry = new Geometry(gl, {
      position: { size: 3, data: positions },
      random: { size: 4, data: randoms },
      color: { size: 3, data: colors },
    });
    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        uTime: { value: 0 },
        uSpread: { value: particleSpread },
        uBaseSize: { value: particleBaseSize * pixelRatio },
        uSizeRandomness: { value: sizeRandomness },
        uAlphaParticles: { value: alphaParticles ? 1 : 0 },
      },
      transparent: true,
      depthTest: false,
    });
    const particles = new Mesh(gl, { mode: gl.POINTS, geometry, program });
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let visible = true;
    let frameId;
    let lastTime = performance.now();
    let elapsed = 0;

    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    observer.observe(container);

    const update = (time) => {
      const delta = time - lastTime;
      lastTime = time;
      if ((!visible || document.hidden) && !reducedMotion) {
        frameId = requestAnimationFrame(update);
        return;
      }
      if (!reducedMotion) elapsed += delta * speed;
      program.uniforms.uTime.value = elapsed * 0.001;
      particles.position.x = moveParticlesOnHover ? -mouseRef.current.x * particleHoverFactor : 0;
      particles.position.y = moveParticlesOnHover ? -mouseRef.current.y * particleHoverFactor : 0;
      if (!disableRotation && !reducedMotion) {
        particles.rotation.x = Math.sin(elapsed * 0.0002) * 0.1;
        particles.rotation.y = Math.cos(elapsed * 0.0005) * 0.15;
        particles.rotation.z += 0.01 * speed;
      }
      renderer.render({ scene: particles, camera });
      if (!reducedMotion) frameId = requestAnimationFrame(update);
    };
    frameId = requestAnimationFrame(update);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resize);
      if (moveParticlesOnHover) container.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(frameId);
      gl.canvas.remove();
    };
  }, [particleCount, particleSpread, speed, moveParticlesOnHover, particleHoverFactor, alphaParticles, particleBaseSize, sizeRandomness, cameraDistance, disableRotation, pixelRatio, particleColors]);

  return <div ref={containerRef} className={`particles-container ${className}`} aria-hidden="true" />;
}
