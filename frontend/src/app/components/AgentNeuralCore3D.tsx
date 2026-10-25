'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface AgentNeuralCore3DProps {
  activeStage?: string;
  verdictRating?: string;
  onSelectAgent?: (agentId: string) => void;
  theme?: 'light' | 'dark';
}

interface AgentNodeDef {
  id: string;
  name: string;
  role: string;
  color: number;
  glowHex: string;
  icon: string;
  radius: number;
  speed: number;
  angleOffset: number;
  yOffset: number;
}

const AGENTS: AgentNodeDef[] = [
  { id: 'quant_engine', name: 'Quant Engine', role: 'Piotroski & Math', color: 0x0284c7, glowHex: '#0284c7', icon: '🔢', radius: 4.6, speed: 0.6, angleOffset: 0, yOffset: 0.8 },
  { id: 'analysts_gathering', name: 'Market Analyst', role: 'Technicals & OHLCV', color: 0x2563eb, glowHex: '#2563eb', icon: '📊', radius: 5.2, speed: 0.45, angleOffset: (Math.PI * 1) / 3, yOffset: -0.6 },
  { id: 'news_sentiment', name: 'News Sentiment', role: 'Macro & Social', color: 0x0891b2, glowHex: '#0891b2', icon: '🌐', radius: 4.8, speed: 0.55, angleOffset: (Math.PI * 2) / 3, yOffset: 1.2 },
  { id: 'bull_bear_debate', name: 'Bull Researcher', role: 'Upside Valuation', color: 0x16a34a, glowHex: '#16a34a', icon: '🐂', radius: 5.4, speed: 0.5, angleOffset: Math.PI, yOffset: -0.9 },
  { id: 'bear_researcher', name: 'Bear Researcher', role: 'Downside Defense', color: 0xe11d48, glowHex: '#e11d48', icon: '🐻', radius: 5.0, speed: 0.52, angleOffset: (Math.PI * 4) / 3, yOffset: 0.5 },
  { id: 'risk_management', name: 'Risk Sentinel', role: 'VaR & Drawdown', color: 0x7c3aed, glowHex: '#7c3aed', icon: '🛡️', radius: 4.9, speed: 0.48, angleOffset: (Math.PI * 5) / 3, yOffset: -0.4 },
];

export default function AgentNeuralCore3D({
  activeStage = 'initializing',
  verdictRating = 'BUY',
  onSelectAgent,
  theme = 'light',
}: AgentNeuralCore3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [hoveredAgentName, setHoveredAgentName] = useState<string | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 700;
    const height = container.clientHeight || 420;

    // 1. Scene, Camera, Renderer
    const isLight = theme === 'light';
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(isLight ? 0xf8fafc : 0x07090e, isLight ? 0.02 : 0.035);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(0, 3.2, 11);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = isLight ? 1.05 : 1.2;
    container.appendChild(renderer.domElement);

    // 2. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, isLight ? 1.15 : 0.7);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x38bdf8, 3, 25);
    pointLight.position.set(0, 0, 0);
    scene.add(pointLight);

    const purpleLight = new THREE.PointLight(0xa855f7, 2, 20);
    purpleLight.position.set(4, 5, 4);
    scene.add(purpleLight);

    // 3. Central Portfolio Manager Core
    const coreGroup = new THREE.Group();
    scene.add(coreGroup);

    // Core Inner Sphere
    const innerGeo = new THREE.IcosahedronGeometry(1.2, 3);
    const innerMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x0369a1,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.8,
      wireframe: false,
    });
    const innerSphere = new THREE.Mesh(innerGeo, innerMat);
    coreGroup.add(innerSphere);

    // Core Outer Wireframe Cage
    const cageGeo = new THREE.IcosahedronGeometry(1.65, 1);
    const cageMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.9,
      wireframe: true,
      transparent: true,
      opacity: 0.65,
    });
    const cageMesh = new THREE.Mesh(cageGeo, cageMat);
    coreGroup.add(cageMesh);

    // Holographic Gyro Rings around Core
    const ringMat1 = new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true, transparent: true, opacity: 0.35 });
    const ringMat2 = new THREE.MeshBasicMaterial({ color: 0xa855f7, wireframe: true, transparent: true, opacity: 0.3 });
    const ringMat3 = new THREE.MeshBasicMaterial({ color: 0x10b981, wireframe: true, transparent: true, opacity: 0.25 });

    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.02, 8, 64), ringMat1);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.02, 8, 64), ringMat2);
    const ring3 = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.02, 8, 64), ringMat3);

    ring1.rotation.x = Math.PI / 3;
    ring2.rotation.y = Math.PI / 4;
    ring3.rotation.z = Math.PI / 6;

    coreGroup.add(ring1);
    coreGroup.add(ring2);
    coreGroup.add(ring3);

    // 4. Background 3D Particle Starfield
    const particlesCount = 450;
    const particlePositions = new Float32Array(particlesCount * 3);
    for (let i = 0; i < particlesCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 36;
      particlePositions[i + 1] = (Math.random() - 0.5) * 26;
      particlePositions[i + 2] = (Math.random() - 0.5) * 36;
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      size: isLight ? 0.09 : 0.08,
      color: isLight ? 0x94a3b8 : 0x64748b,
      transparent: true,
      opacity: isLight ? 0.45 : 0.55,
      blending: isLight ? THREE.NormalBlending : THREE.AdditiveBlending,
    });
    const particlePoints = new THREE.Points(particleGeo, particleMat);
    scene.add(particlePoints);

    // 5. Agent Satellites & Energy Beams
    const agentMeshes: { [id: string]: { group: THREE.Group; sphere: THREE.Mesh; line: THREE.Line; def: AgentNodeDef } } = {};

    AGENTS.forEach((agent) => {
      const aGroup = new THREE.Group();

      // Satellite Sphere
      const sGeo = new THREE.SphereGeometry(0.35, 24, 24);
      const sMat = new THREE.MeshStandardMaterial({
        color: agent.color,
        emissive: agent.color,
        emissiveIntensity: 0.8,
        roughness: 0.3,
        metalness: 0.7,
      });
      const sMesh = new THREE.Mesh(sGeo, sMat);
      aGroup.add(sMesh);

      // Outer Glow Halo
      const haloGeo = new THREE.SphereGeometry(0.48, 16, 16);
      const haloMat = new THREE.MeshBasicMaterial({
        color: agent.color,
        wireframe: true,
        transparent: true,
        opacity: 0.45,
      });
      const haloMesh = new THREE.Mesh(haloGeo, haloMat);
      aGroup.add(haloMesh);

      scene.add(aGroup);

      // Laser energy beam from Satellite to Core
      const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)]);
      const lineMat = new THREE.LineBasicMaterial({
        color: agent.color,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      scene.add(line);

      agentMeshes[agent.id] = { group: aGroup, sphere: sMesh, line, def: agent };
    });

    // 6. Interactive Mouse Drag / Parallax
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;
    let isDragging = false;
    let prevMousePos = { x: 0, y: 0 };
    let rotX = 0;
    let rotY = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMousePos = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      targetX = x * 0.7;
      targetY = y * 0.4;

      if (isDragging) {
        const deltaX = e.clientX - prevMousePos.x;
        const deltaY = e.clientY - prevMousePos.y;
        rotY += deltaX * 0.005;
        rotX += deltaY * 0.005;
        prevMousePos = { x: e.clientX, y: e.clientY };
      }
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('mousemove', onMouseMove);

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 7. Animation Loop
    const startTime = performance.now();
    let animId: number;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsedTime = (performance.now() - startTime) * 0.001;

      // Smooth mouse follow
      mouseX += (targetX - mouseX) * 0.05;
      mouseY += (targetY - mouseY) * 0.05;

      camera.position.x = Math.sin(rotY + mouseX * 0.5) * 11;
      camera.position.z = Math.cos(rotY + mouseX * 0.5) * 11;
      camera.position.y = 3.2 + rotX * 2.5 + mouseY * 1.5;
      camera.lookAt(0, 0, 0);

      // Core rotations & pulse
      cageMesh.rotation.x = elapsedTime * 0.25;
      cageMesh.rotation.y = elapsedTime * 0.35;
      innerSphere.rotation.y = -elapsedTime * 0.4;

      const pulse = 1 + Math.sin(elapsedTime * 2.5) * 0.06;
      innerSphere.scale.set(pulse, pulse, pulse);

      ring1.rotation.x += 0.008;
      ring1.rotation.y += 0.005;
      ring2.rotation.y += 0.009;
      ring2.rotation.z += 0.006;
      ring3.rotation.z += 0.007;

      // Rotate background particles
      particlePoints.rotation.y = elapsedTime * 0.02;

      // Update Agent Satellites
      AGENTS.forEach((agent) => {
        const item = agentMeshes[agent.id];
        if (!item) return;

        const angle = elapsedTime * agent.speed * 0.45 + agent.angleOffset;
        const x = Math.cos(angle) * agent.radius;
        const z = Math.sin(angle) * agent.radius;
        const y = agent.yOffset + Math.sin(elapsedTime * 1.5 + agent.angleOffset) * 0.35;

        item.group.position.set(x, y, z);
        item.group.rotation.y += 0.02;

        // Active stage highlighting
        const isCurrentActive = activeStage.includes(agent.id) || (activeStage === 'analysts_gathering' && ['analysts_gathering', 'news_sentiment'].includes(agent.id));
        const emissiveIntensity = isCurrentActive ? 2.5 : 0.8;
        (item.sphere.material as THREE.MeshStandardMaterial).emissiveIntensity = emissiveIntensity;
        item.sphere.scale.setScalar(isCurrentActive ? 1.35 : 1.0);

        // Update Laser Beam to Core
        const positions = (item.line.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
        positions[0] = x;
        positions[1] = y;
        positions[2] = z;
        positions[3] = 0;
        positions[4] = 0;
        positions[5] = 0;
        item.line.geometry.attributes.position.needsUpdate = true;

        (item.line.material as THREE.LineBasicMaterial).opacity = isCurrentActive ? 0.85 : 0.25;
      });

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [activeStage, theme]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '420px', borderRadius: '18px', overflow: 'hidden', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-card)' }}>
      {/* Three.js Container */}
      <div ref={mountRef} style={{ width: '100%', height: '100%', cursor: 'grab' }} />

      {/* Floating UI Overlays */}
      <div style={{ position: 'absolute', top: '16px', left: '20px', pointerEvents: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span className="pulse-dot" style={{ backgroundColor: 'var(--accent-primary)', boxShadow: '0 0 12px var(--accent-primary)' }} />
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--accent-primary)', letterSpacing: '1px', textTransform: 'uppercase' }}>
            3D Neural Swarm Architecture
          </span>
        </div>
        <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.3px' }}>
          Autonomous Multi-Agent Synthesis
        </div>
        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
          Click &amp; drag to rotate 3D perspective | Orbs represent active specialized agents
        </div>
      </div>

      {/* Active Consensus Badge in 3D Corner */}
      <div style={{ position: 'absolute', top: '16px', right: '20px', background: 'var(--bg-surface)', backdropFilter: 'blur(12px)', border: '1px solid var(--border-subtle)', padding: '10px 16px', borderRadius: '12px', textAlign: 'right', boxShadow: 'var(--shadow-card)' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 700 }}>Consensus Core</div>
        <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
          Portfolio Manager
        </div>
        <div style={{ fontSize: '11px', color: 'var(--bull-green)', fontWeight: 600 }}>
          ● Synthesizing Alpha
        </div>
      </div>

      {/* Bottom Floating Legend / Quick Agent Selector */}
      <div style={{ position: 'absolute', bottom: '16px', left: '20px', right: '20px', display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
        {AGENTS.map((ag) => {
          const isActive = activeStage.includes(ag.id);
          return (
            <button
              key={ag.id}
              onClick={() => {
                setSelectedAgent(ag.id);
                if (onSelectAgent) onSelectAgent(ag.id);
              }}
              style={{
                background: isActive ? 'var(--accent-cyan-bg)' : 'var(--bg-surface)',
                backdropFilter: 'blur(8px)',
                border: isActive ? `1.5px solid ${ag.glowHex}` : '1px solid var(--border-subtle)',
                padding: '6px 12px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <span style={{ fontSize: '14px' }}>{ag.icon}</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)' }}>{ag.name}</div>
                <div style={{ fontSize: '9.5px', color: ag.glowHex, fontWeight: 700 }}>{ag.role}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
