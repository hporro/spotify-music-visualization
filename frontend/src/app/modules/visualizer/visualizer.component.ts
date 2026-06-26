import { Component, ElementRef, Input, OnInit, AfterViewInit, OnDestroy, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { PlayerService } from '../../core/player.service';
import { PlaybackState, AudioFeatures, AudioAnalysis, TimeInterval, SpotifySegment } from '../../models/spotify.models';

export type VisualizerMode = 'bars2d' | 'radial2d' | 'oscilloscope2d' | 'sphere3d' | 'particles3d' | 'grid3d' | 'waterfall3d' | 'symphony3d';

@Component({
  selector: 'app-visualizer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="visualizer-container">
      <canvas #canvas2d [style.display]="(mode === 'bars2d' || mode === 'radial2d' || mode === 'oscilloscope2d') ? 'block' : 'none'"></canvas>
      <canvas #canvas3d [style.display]="(mode !== 'bars2d' && mode !== 'radial2d' && mode !== 'oscilloscope2d') ? 'block' : 'none'"></canvas>
      
      <div class="render-error-banner" *ngIf="renderError">
        {{ renderError }}
      </div>

      <!-- Real FFT Live Audio Sync Overlay -->
      <div class="audio-capture-overlay" *ngIf="!useTabAudio && !dismissedAudioPrompt">
        <div class="overlay-card">
          <div class="overlay-icon">
            <svg viewBox="0 0 24 24" width="40" height="40" fill="#1db954">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
          </div>
          <h3>Sync Live Tab Audio</h3>
          <p>Enable 100% accurate, beat-synced visuals by sharing this browser tab's audio.</p>
          <div class="overlay-actions">
            <button class="overlay-btn primary" (click)="startTabAudio()">Share Tab Audio</button>
            <button class="overlay-btn secondary" (click)="dismissPrompt()">Procedural Fallback</button>
          </div>
        </div>
      </div>

      <div class="visualizer-controls">
        <button class="tab-audio-btn" (click)="toggleTabAudio()" [class.active]="useTabAudio" title="Toggle Real FFT via Tab Audio">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12zm-9-9v6l5-3-5-3z"/>
          </svg>
          <span>{{ useTabAudio ? 'Real FFT (Tab: ON)' : 'Procedural (Tab: OFF)' }}</span>
        </button>
        <div class="mode-indicator" *ngIf="showModeIndicator">
          Mode: {{ activeModeName }}
        </div>
      </div>
    </div>
  `,
  styles: [`
    .visualizer-container {
      width: 100%;
      height: 100%;
      position: relative;
      background-color: #050608;
      overflow: hidden;
      border-radius: 16px;
    }
    canvas {
      width: 100%;
      height: 100%;
      display: block;
    }
    .visualizer-controls {
      position: absolute;
      top: 16px;
      right: 16px;
      display: flex;
      gap: 8px;
      align-items: center;
      z-index: 10;
    }
    .tab-audio-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 20px;
      color: #9a9b9f;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .tab-audio-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
      border-color: rgba(255, 255, 255, 0.25);
    }
    .tab-audio-btn.active {
      background: rgba(29, 185, 84, 0.2);
      border-color: rgba(29, 185, 84, 0.5);
      color: #1db954;
      box-shadow: 0 0 10px rgba(29, 185, 84, 0.2);
    }
    .mode-indicator {
      padding: 6px 12px;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      color: #9a9b9f;
      font-size: 0.75rem;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 1px;
      pointer-events: none;
    }
    .render-error-banner {
      position: absolute;
      bottom: 16px;
      left: 16px;
      padding: 8px 16px;
      background: rgba(220, 53, 69, 0.95);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      color: #ffffff;
      font-family: monospace;
      font-size: 0.75rem;
      z-index: 100;
      pointer-events: none;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    }
    .audio-capture-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      background: rgba(5, 6, 8, 0.7);
      backdrop-filter: blur(12px);
      z-index: 50;
      padding: 24px;
    }
    .overlay-card {
      max-width: 400px;
      width: 100%;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      padding: 32px 24px;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    }
    .overlay-icon {
      margin-bottom: 20px;
      filter: drop-shadow(0 0 10px rgba(29, 185, 84, 0.3));
      animation: pulse-glow 2s infinite ease-in-out;
    }
    .overlay-card h3 {
      font-size: 1.25rem;
      font-weight: 700;
      color: #ffffff;
      margin: 0 0 12px 0;
      font-family: 'Outfit', sans-serif;
    }
    .overlay-card p {
      font-size: 0.85rem;
      color: #9a9b9f;
      margin: 0 0 24px 0;
      line-height: 1.5;
    }
    .overlay-actions {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .overlay-btn {
      padding: 12px;
      border-radius: 30px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
    }
    .overlay-btn.primary {
      background: #1db954;
      color: #000000;
    }
    .overlay-btn.primary:hover {
      background: #1ed760;
      transform: scale(1.02);
      box-shadow: 0 0 15px rgba(29, 185, 84, 0.4);
    }
    .overlay-btn.secondary {
      background: transparent;
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.15);
    }
    .overlay-btn.secondary:hover {
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(255, 255, 255, 0.3);
    }
    @keyframes pulse-glow {
      0%, 100% { transform: scale(1); filter: drop-shadow(0 0 8px rgba(29, 185, 84, 0.2)); }
      50% { transform: scale(1.08); filter: drop-shadow(0 0 18px rgba(29, 185, 84, 0.5)); }
    }
  `]
})
export class VisualizerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvas2d') canvas2dRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('canvas3d') canvas3dRef!: ElementRef<HTMLCanvasElement>;
  @Input() mode: VisualizerMode = 'bars2d';
  @Input() sensitivity: number = 1.0;
  @Input() showModeIndicator: boolean = true;
  renderError: string | null = null;

  // Data streams
  private playbackState: PlaybackState | null = null;
  private audioFeatures: AudioFeatures | null = null;
  private audioAnalysis: AudioAnalysis | null = null;

  // Real-time track progress calculation
  private currentProgress: number = 0; // in seconds
  private lastStateUpdateTime: number = 0; // Date.now() timestamp
  private animationFrameId: number | null = null;

  // 2D Canvas context
  private ctx: CanvasRenderingContext2D | null = null;

  // 3D Three.js variables
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private clock = new THREE.Clock();

  // Three.js Objects
  private pulseSphere!: THREE.Mesh;
  private sphereOriginalPositions!: Float32Array;
  private sphereWireframe!: THREE.LineSegments;
  private particlesOriginalPositions!: Float32Array;
  private particleSystem!: THREE.Points;
  private gridCubes: THREE.Mesh[] = [];
  private waterfallGeometry!: THREE.PlaneGeometry;
  private waterfallMesh!: THREE.Mesh;
  private ambientLight!: THREE.AmbientLight;
  private pointLight!: THREE.PointLight;

  // Symphony Three.js Objects
  private symphonyGroup!: THREE.Group;
  private symphonyCore!: THREE.Mesh;
  private symphonyRings: THREE.Mesh[] = [];
  private symphonyMelodyCrystals: THREE.Mesh[] = [];
  private symphonyPercussionStars: THREE.Mesh[] = [];
  private symphonyAtmosphere!: THREE.Points;

  // Visual state variables
  private beatScale: number = 1.0;
  private currentBeatIndex: number = -1;
  private lastBeatTime: number = 0;
  private beatProgress: number = 0; // 0 (just hit) to 1 (decayed)

  // FFT and time-domain states
  private numFftBars = 64;
  private fftSmoothed: number[] = [];
  private fftPeaks: number[] = [];
  private fftPeakHold: number[] = [];
  private timeDomainRaw: number[] = [];

  // Waterfall 3D history state
  private waterfallHistory: number[][] = [];
  private maxWaterfallRows = 40;
  private numWaterfallCols = 30;

  // Web Audio variables for Tab Audio capture
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private tabAudioStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  useTabAudio: boolean = false;
  dismissedAudioPrompt: boolean = false;
  
  constructor(private playerService: PlayerService) {
    this.fftSmoothed = new Array(this.numFftBars).fill(0);
    this.fftPeaks = new Array(this.numFftBars).fill(0);
    this.fftPeakHold = new Array(this.numFftBars).fill(0);
    this.timeDomainRaw = new Array(128).fill(0);

    // Initialize waterfall history with zeroes
    for (let r = 0; r < this.maxWaterfallRows; r++) {
      this.waterfallHistory.push(new Array(this.numWaterfallCols).fill(0));
    }
  }

  get activeModeName(): string {
    switch (this.mode) {
      case 'bars2d': return '2D Neon Bars';
      case 'radial2d': return '2D Neon Radial';
      case 'oscilloscope2d': return '2D Oscilloscope';
      case 'sphere3d': return '3D Pulse Sphere';
      case 'particles3d': return '3D Particle Orbit';
      case 'grid3d': return '3D Bouncing Spectrum';
      case 'waterfall3d': return '3D Scrolling Terrain';
      case 'symphony3d': return '3D Symphony';
    }
  }

  ngOnInit(): void {
    // Subscribe to player state changes
    this.playerService.getPlaybackState$().subscribe(state => {
      this.playbackState = state;
      this.lastStateUpdateTime = Date.now();
      
      // Update local clock on play/pause transition
      if (state && state.is_playing) {
        this.clock.start();
      } else {
        this.clock.stop();
      }
    });

    this.playerService.getAudioFeatures$().subscribe(features => {
      this.audioFeatures = features;
    });

    this.playerService.getAudioAnalysis$().subscribe(analysis => {
      this.audioAnalysis = analysis;
      this.currentBeatIndex = -1;
    });
  }

  ngAfterViewInit(): void {
    this.initRenderers();
    this.startAnimationLoop();
  }

  ngOnDestroy(): void {
    this.stopAnimationLoop();
    this.disposeThreeJs();
    this.stopTabAudio();
  }

  private checkCanvasSizes(): void {
    const is2D = this.mode === 'bars2d' || this.mode === 'radial2d' || this.mode === 'oscilloscope2d';
    if (is2D) {
      if (this.canvas2dRef && this.canvas2dRef.nativeElement) {
        const canvas2d = this.canvas2dRef.nativeElement;
        const width = canvas2d.clientWidth;
        const height = canvas2d.clientHeight;
        if (width > 0 && height > 0 && (canvas2d.width !== width || canvas2d.height !== height)) {
          canvas2d.width = width;
          canvas2d.height = height;
        }
      }
    } else {
      if (this.canvas3dRef && this.canvas3dRef.nativeElement && this.renderer && this.camera) {
        const canvas3d = this.canvas3dRef.nativeElement;
        const width = canvas3d.clientWidth;
        const height = canvas3d.clientHeight;
        if (width > 0 && height > 0 && (canvas3d.width !== width || canvas3d.height !== height)) {
          canvas3d.width = width;
          canvas3d.height = height;
          this.camera.aspect = width / height;
          this.camera.updateProjectionMatrix();
          this.renderer.setSize(width, height, false);
        }
      }
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    this.checkCanvasSizes();
  }

  private initRenderers(): void {
    try {
      const canvas2d = this.canvas2dRef.nativeElement;
      const canvas3d = this.canvas3dRef.nativeElement;

      canvas2d.width = canvas2d.clientWidth;
      canvas2d.height = canvas2d.clientHeight;
      this.ctx = canvas2d.getContext('2d');

      canvas3d.width = canvas3d.clientWidth;
      canvas3d.height = canvas3d.clientHeight;

      // Init Three.js
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x050608);

      // Setup Camera
      this.camera = new THREE.PerspectiveCamera(
        45,
        canvas3d.width / canvas3d.height,
        0.1,
        1000
      );
      this.camera.position.z = 20;

      // Setup WebGL Renderer
      this.renderer = new THREE.WebGLRenderer({
        canvas: canvas3d,
        antialias: true,
        alpha: false
      });
      this.renderer.setSize(canvas3d.width, canvas3d.height, false);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      // Setup Lighting
      this.ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
      this.scene.add(this.ambientLight);

      this.pointLight = new THREE.PointLight(0x1db954, 2.0, 100);
      this.pointLight.position.set(0, 5, 10);
      this.scene.add(this.pointLight);

      // Create 3D meshes
      this.create3dSphere();
      this.create3dParticles();
      this.create3dGrid();
      this.create3dWaterfall();
      this.create3dSymphony();
    } catch (err: any) {
      console.error('Init Error:', err);
      this.renderError = `Initialization Error: ${err.message || err}`;
    }
  }

  private create3dSphere(): void {
    // Inner Glow Sphere
    const geom = new THREE.SphereGeometry(3, 32, 32);
    // Store original positions for dynamic deformation
    this.sphereOriginalPositions = geom.attributes['position'].array.slice() as Float32Array;

    const mat = new THREE.MeshPhongMaterial({
      color: 0x1db954,
      emissive: 0x074a20,
      shininess: 30,
      flatShading: true
    });
    this.pulseSphere = new THREE.Mesh(geom, mat);
    this.scene.add(this.pulseSphere);

    // Outer Wireframe Sphere
    const wireframeGeom = new THREE.SphereGeometry(3.1, 16, 16);
    const wireframe = new THREE.WireframeGeometry(wireframeGeom);
    this.sphereWireframe = new THREE.LineSegments(
      wireframe,
      new THREE.LineBasicMaterial({
        color: 0x8a2be2,
        linewidth: 1,
        transparent: true,
        opacity: 0.8
      })
    );
    this.scene.add(this.sphereWireframe);
  }

  private create3dParticles(): void {
    const particleCount = 600;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      // Random coordinates in a sphere shell
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 4 + Math.random() * 6; // Radius between 4 and 10

      positions[i] = r * Math.sin(phi) * Math.cos(theta);
      positions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i + 2] = r * Math.cos(phi);

      // Gradient color (green to purple)
      const mixRatio = Math.random();
      colors[i] = THREE.MathUtils.lerp(0.11, 0.54, mixRatio); // R
      colors[i + 1] = THREE.MathUtils.lerp(0.72, 0.17, mixRatio); // G
      colors[i + 2] = THREE.MathUtils.lerp(0.33, 0.89, mixRatio); // B
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Store original positions for dynamic deformation to prevent coordinates from accumulating
    this.particlesOriginalPositions = positions.slice();

    // Custom glowing particle texture can be simulated with canvas-drawn circular textures
    const material = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });

    this.particleSystem = new THREE.Points(geometry, material);
    this.scene.add(this.particleSystem);
  }

  private create3dGrid(): void {
    const gridCols = 8;
    const gridRows = 8;
    const spacing = 1.2;
    const geom = new THREE.BoxGeometry(0.8, 1, 0.8);

    const startX = -((gridCols - 1) * spacing) / 2;
    const startZ = -((gridRows - 1) * spacing) / 2;

    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        // Create custom gradient colors for bars
        const mat = new THREE.MeshPhongMaterial({
          color: new THREE.Color().setHSL((r * gridCols + c) / (gridCols * gridRows), 0.8, 0.5),
          shininess: 50
        });

        const cube = new THREE.Mesh(geom, mat);
        cube.position.set(startX + c * spacing, 0, startZ + r * spacing);
        this.scene.add(cube);
        this.gridCubes.push(cube);
      }
    }
  }

  private create3dWaterfall(): void {
    const widthSegs = this.numWaterfallCols - 1;
    const heightSegs = this.maxWaterfallRows - 1;
    
    this.waterfallGeometry = new THREE.PlaneGeometry(24, 18, widthSegs, heightSegs);
    this.waterfallGeometry.rotateX(-Math.PI / 2);

    const numVertices = this.numWaterfallCols * this.maxWaterfallRows;
    const colors = new Float32Array(numVertices * 3);
    this.waterfallGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.MeshPhongMaterial({
      vertexColors: true,
      wireframe: true,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      shininess: 30
    });

    this.waterfallMesh = new THREE.Mesh(this.waterfallGeometry, mat);
    this.waterfallMesh.position.set(0, -2, 0);
    this.scene.add(this.waterfallMesh);
  }

  private create3dSymphony(): void {
    this.symphonyGroup = new THREE.Group();

    // 1. Central Core (Bass Drum) - Octahedron Geometry
    const coreGeom = new THREE.OctahedronGeometry(2.0, 1);
    const coreMat = new THREE.MeshPhongMaterial({
      color: 0x1db954, // Green
      emissive: 0x0a3314,
      shininess: 80,
      flatShading: true
    });
    this.symphonyCore = new THREE.Mesh(coreGeom, coreMat);
    this.symphonyGroup.add(this.symphonyCore);

    // 2. Gyro Rings (Rhythm Chords) - Toruses
    const ringCount = 3;
    const ringColors = [0xff007f, 0x00f0ff, 0xa82be2]; // Hot Pink, Cyan, Purple
    for (let i = 0; i < ringCount; i++) {
      const ringGeom = new THREE.TorusGeometry(4.5 + i * 0.4, 0.08, 8, 48);
      const ringMat = new THREE.MeshPhongMaterial({
        color: ringColors[i],
        emissive: new THREE.Color(ringColors[i]).multiplyScalar(0.2),
        shininess: 100,
        flatShading: true
      });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      
      if (i === 0) ringMesh.rotation.x = Math.PI / 2;
      if (i === 1) ringMesh.rotation.y = Math.PI / 2;
      if (i === 2) {
        ringMesh.rotation.x = Math.PI / 4;
        ringMesh.rotation.y = Math.PI / 4;
      }
      
      this.symphonyRings.push(ringMesh);
      this.symphonyGroup.add(ringMesh);
    }

    // 3. Melody Crystals - Orbiting Cones
    const crystalCount = 8;
    const crystalColors = [0xff5500, 0xffbb00, 0x00ff66, 0x0099ff, 0x7700ff, 0xff00bb, 0x00ffcc, 0xffcc00];
    const crystalGeom = new THREE.ConeGeometry(0.5, 1.2, 4);
    crystalGeom.rotateX(Math.PI / 4);
    
    for (let i = 0; i < crystalCount; i++) {
      const crystalMat = new THREE.MeshPhongMaterial({
        color: crystalColors[i],
        emissive: new THREE.Color(crystalColors[i]).multiplyScalar(0.3),
        shininess: 90,
        flatShading: true
      });
      const crystalMesh = new THREE.Mesh(crystalGeom, crystalMat);
      this.symphonyMelodyCrystals.push(crystalMesh);
      this.symphonyGroup.add(crystalMesh);
    }

    // 4. Percussion Stars - Outer Ring of Cubes
    const starCount = 16;
    const starGeom = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const starMat = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      emissive: 0x333333,
      shininess: 100
    });
    for (let i = 0; i < starCount; i++) {
      const customMat = starMat.clone();
      const starMesh = new THREE.Mesh(starGeom, customMat);
      this.symphonyPercussionStars.push(starMesh);
      this.symphonyGroup.add(starMesh);
    }

    // 5. Atmosphere Harmony - Starfield
    const particleCount = 120;
    const starfieldGeom = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 12 + Math.random() * 8;

      positions[i] = r * Math.sin(phi) * Math.cos(theta);
      positions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i + 2] = r * Math.cos(phi);

      colors[i] = 0.0;
      colors[i + 1] = THREE.MathUtils.lerp(0.3, 0.8, Math.random());
      colors[i + 2] = THREE.MathUtils.lerp(0.8, 1.0, Math.random());
    }

    starfieldGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starfieldGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const starfieldMat = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });

    this.symphonyAtmosphere = new THREE.Points(starfieldGeom, starfieldMat);
    this.symphonyGroup.add(this.symphonyAtmosphere);

    this.scene.add(this.symphonyGroup);
  }

  private simulateAudioInput(): void {
    const energy = this.audioFeatures ? this.audioFeatures.energy : 0.5;
    const activeSeg = this.getActiveSegment();
    const loudness = activeSeg ? Math.max(0, (activeSeg.loudness_max + 60) / 60) : 0.5;
    const time = Date.now();

    // 1. Simulate FFT data
    for (let i = 0; i < this.numFftBars; i++) {
      const ratio = i / (this.numFftBars - 1);
      let rawVal = 0;

      // Base sine waves for continuous ambient movement
      const wave = Math.sin(ratio * Math.PI * 4 - time * 0.003) * 0.15 + 0.15;
      const fastWave = Math.sin(ratio * Math.PI * 12 + time * 0.008) * 0.08 + 0.08;

      if (ratio < 0.2) {
        // Bass Range (Low frequencies on the left): pulses strongly to beats/loudness
        const bassPitch = (activeSeg && activeSeg.pitches) ? activeSeg.pitches[0] : 0.5;
        rawVal = (this.beatScale - 1.0) * 1.8 + loudness * 0.5 + bassPitch * 0.3 + wave;
      } else if (ratio < 0.65) {
        // Mid Range (Vocal/instrument frequencies): mapped to chromatic pitches/timbre
        let pitchVal = 0.4;
        if (activeSeg && activeSeg.pitches) {
          const pitchIndex = Math.floor((ratio - 0.2) / 0.45 * 12) % 12;
          pitchVal = activeSeg.pitches[pitchIndex];
        }
        let timbreVal = 0.5;
        if (activeSeg && activeSeg.timbre && activeSeg.timbre.length > 0) {
          const tIndex = i % activeSeg.timbre.length;
          timbreVal = (activeSeg.timbre[tIndex] + 100) / 200;
        }
        rawVal = pitchVal * 0.5 + timbreVal * 0.3 + energy * 0.2 + fastWave;
      } else {
        // Treble Range (High frequencies on the right): percussion ticks, transients & high noise
        const noise = Math.random() * 0.2;
        let highPitch = 0.3;
        if (activeSeg && activeSeg.pitches) {
          highPitch = activeSeg.pitches[i % 12];
        }
        rawVal = energy * 0.3 + highPitch * 0.2 + noise + fastWave * 0.5;
      }

      // Apply a logarithmic scale roll-off towards higher frequencies (more natural FFT look)
      const envelope = Math.pow(1.0 - ratio, 0.4) * 0.85 + 0.15;
      rawVal = rawVal * envelope;

      // Sensitivity and play state scaling
      let targetVal = rawVal * energy * this.sensitivity;
      if (!this.playbackState || !this.playbackState.is_playing) {
        targetVal = (Math.sin(ratio * Math.PI * 4 + time * 0.0015) * 0.03 + 0.03) * this.sensitivity;
      }

      targetVal = Math.min(1.0, Math.max(0, targetVal));

      // Apply smoothing interpolation
      const currentVal = this.fftSmoothed[i] || 0;
      if (targetVal > currentVal) {
        this.fftSmoothed[i] = currentVal * 0.35 + targetVal * 0.65; // fast rise
      } else {
        const decayRate = 0.03 * (1.0 - ratio * 0.5) + 0.005; // bass decays slower
        this.fftSmoothed[i] = Math.max(targetVal, currentVal - decayRate);
      }

      // Peak indicators logic
      const smoothedVal = this.fftSmoothed[i];
      const peakVal = this.fftPeaks[i] || 0;
      if (smoothedVal >= peakVal) {
        this.fftPeaks[i] = smoothedVal;
        this.fftPeakHold[i] = 18; // hold frame count
      } else {
        if (this.fftPeakHold[i] > 0) {
          this.fftPeakHold[i]--;
        } else {
          this.fftPeaks[i] = Math.max(0, peakVal - 0.012); // slow drop
        }
      }
    }

    // 2. Simulate Time Domain wave (128 samples)
    this.timeDomainRaw = [];
    const bufferLength = 128;
    const bassVal = (this.beatScale - 1.0) * 1.5;
    for (let i = 0; i < bufferLength; i++) {
      const ratio = i / bufferLength;
      const wave1 = Math.sin(ratio * Math.PI * 4 - time * 0.008) * (0.2 + bassVal * 0.4);
      const wave2 = Math.sin(ratio * Math.PI * 18 + time * 0.015) * 0.08;
      const wave3 = Math.sin(ratio * Math.PI * 40 - time * 0.02) * (0.02 + bassVal * 0.05);
      
      let finalVal = (wave1 + wave2 + wave3) * this.sensitivity;
      if (!this.playbackState || !this.playbackState.is_playing) {
        finalVal = Math.sin(ratio * Math.PI * 8 - time * 0.002) * 0.02 * this.sensitivity;
      }
      this.timeDomainRaw.push(Math.min(1.0, Math.max(-1.0, finalVal)));
    }
  }

  private startAnimationLoop(): void {
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);
      this.updateProgress();
      this.checkCanvasSizes();
      
      if (this.useTabAudio && this.analyser) {
        this.processTabAudioInput();
      } else {
        this.detectBeat();
        this.simulateAudioInput();
      }
      
      const is2dMode = this.mode === 'bars2d' || this.mode === 'radial2d' || this.mode === 'oscilloscope2d';
      if (is2dMode) {
        this.render2d();
      } else {
        this.render3d();
      }
    };
    this.animationFrameId = requestAnimationFrame(animate);
  }

  toggleTabAudio(): void {
    if (this.useTabAudio) {
      this.stopTabAudio();
    } else {
      this.startTabAudio();
    }
  }

  dismissPrompt(): void {
    this.dismissedAudioPrompt = true;
  }

  async startTabAudio(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        audio: true,
        video: true,
        preferCurrentTab: true,
        selfBrowserSurface: 'include'
      } as any);

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        stream.getVideoTracks().forEach(track => track.stop());
        throw new Error('No audio track was shared. Please check "Share tab audio" in the screen sharing popup.');
      }

      // Stop video tracks immediately to minimize system resource usage
      stream.getVideoTracks().forEach(track => track.stop());

      this.tabAudioStream = stream;
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 128; // 64 frequency bins, matching numFftBars
      this.sourceNode = this.audioCtx.createMediaStreamSource(stream);
      this.sourceNode.connect(this.analyser);
      this.useTabAudio = true;
      console.log('Real FFT: Tab audio capture started successfully.');

      // Listen for the stream ending (e.g. user stops sharing from browser UI)
      audioTracks[0].onended = () => {
        this.stopTabAudio();
      };
    } catch (err: any) {
      console.error('Failed to access tab audio for Real FFT:', err);
      let message = 'Screen/Tab audio share permission is required to capture real-time audio for the visualizer.';
      if (err && err.message) {
        message += ` Details: ${err.message}`;
      }
      alert(message);
      this.useTabAudio = false;
    }
  }

  private stopTabAudio(): void {
    if (this.tabAudioStream) {
      this.tabAudioStream.getTracks().forEach(track => track.stop());
      this.tabAudioStream = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
    this.analyser = null;
    this.useTabAudio = false;
    console.log('Real FFT: Tab audio capture stopped.');
  }

  private processTabAudioInput(): void {
    if (!this.analyser) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    for (let i = 0; i < this.numFftBars; i++) {
      const rawByte = dataArray[i];
      const rawVal = (rawByte !== undefined && !isNaN(rawByte)) ? (rawByte / 255.0) : 0.0;
      let targetVal = rawVal * this.sensitivity;
      if (isNaN(targetVal)) {
        targetVal = 0.0;
      }
      targetVal = Math.min(1.0, Math.max(0, targetVal));

      // Apply smoothing
      const currentVal = this.fftSmoothed[i] || 0;
      if (targetVal > currentVal) {
        this.fftSmoothed[i] = currentVal * 0.3 + targetVal * 0.7; // fast rise
      } else {
        this.fftSmoothed[i] = Math.max(targetVal, currentVal - 0.04); // slow decay
      }

      if (isNaN(this.fftSmoothed[i])) {
        this.fftSmoothed[i] = 0.0;
      }

      // Peaks logic
      const smoothedVal = this.fftSmoothed[i];
      const peakVal = this.fftPeaks[i] || 0;
      if (smoothedVal >= peakVal) {
        this.fftPeaks[i] = smoothedVal;
        this.fftPeakHold[i] = 18;
      } else {
        if (this.fftPeakHold[i] > 0) {
          this.fftPeakHold[i]--;
        } else {
          this.fftPeaks[i] = Math.max(0, peakVal - 0.012);
        }
      }
      if (isNaN(this.fftPeaks[i])) {
        this.fftPeaks[i] = 0.0;
      }
    }

    // Capture time-domain data for the Oscilloscope
    const timeDomainArray = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(timeDomainArray);
    this.timeDomainRaw = [];
    for (let i = 0; i < this.analyser.fftSize; i++) {
      const byteVal = timeDomainArray[i];
      const normVal = (byteVal !== undefined && !isNaN(byteVal)) ? ((byteVal - 128) / 128) : 0.0;
      this.timeDomainRaw.push(normVal);
    }

    // Real-time Bass Beat Detection from Tab FFT
    let bassSum = 0;
    const bassBins = Math.min(4, this.numFftBars);
    for (let i = 0; i < bassBins; i++) {
      bassSum += this.fftSmoothed[i] || 0;
    }
    const bassAvg = bassSum / bassBins;

    if (bassAvg > 0.55 && this.beatScale <= 1.05) {
      this.beatScale = 1.0 + (bassAvg - 0.4) * 0.6 * this.sensitivity;
      this.beatProgress = 0;
      this.lastBeatTime = this.currentProgress;
    } else {
      this.beatScale = THREE.MathUtils.lerp(this.beatScale, 1.0, 0.15);
      this.beatProgress = Math.min(1.0, this.beatProgress + 0.05);
    }
  }

  private stopAnimationLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private updateProgress(): void {
    if (!this.playbackState) {
      this.currentProgress = 0;
      return;
    }

    if (this.playbackState.is_playing) {
      const now = Date.now();
      const elapsed = (now - this.lastStateUpdateTime);
      this.currentProgress = (this.playbackState.progress_ms + elapsed) / 1000.0;

      // Cap at track duration if we know it
      if (this.playbackState.item) {
        const durationSec = this.playbackState.item.duration_ms / 1000.0;
        if (this.currentProgress > durationSec) {
          this.currentProgress = durationSec;
        }
      }
    } else {
      this.currentProgress = this.playbackState.progress_ms / 1000.0;
    }
  }

  private getTrackHash(trackId: string): number {
    let hash = 0;
    if (!trackId) return 0;
    for (let i = 0; i < trackId.length; i++) {
      const char = trackId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  private detectBeat(): void {
    if (!this.audioAnalysis || !this.audioAnalysis.beats || this.audioAnalysis.beats.length === 0) {
      // Procedural Fallback Beat Detection (using track ID hash for deterministic beats)
      const trackId = this.playbackState?.item?.id || 'procedural_default';
      const hash = this.getTrackHash(trackId);
      const tempo = 95 + (hash % 60); // 95 to 155 BPM
      const beatInterval = 60.0 / tempo;
      const currentBeatNumber = Math.floor(this.currentProgress / beatInterval);

      if (currentBeatNumber !== this.currentBeatIndex) {
        this.currentBeatIndex = currentBeatNumber;
        this.lastBeatTime = currentBeatNumber * beatInterval;
        const energy = this.audioFeatures ? this.audioFeatures.energy : 0.6 + (hash % 10) * 0.03;
        this.beatScale = 1.0 + (0.35 * energy * this.sensitivity);
      }

      const elapsed = this.currentProgress - this.lastBeatTime;
      this.beatProgress = Math.min(1.0, elapsed / beatInterval);
      this.beatScale = THREE.MathUtils.lerp(this.beatScale, 1.0, 0.15);
      return;
    }

    // Find the beat corresponding to current progress
    const beats = this.audioAnalysis.beats;
    let activeBeat: TimeInterval | null = null;
    let activeIndex = -1;

    // Perform linear scan
    for (let i = 0; i < beats.length; i++) {
      const beat = beats[i];
      if (this.currentProgress >= beat.start && this.currentProgress < beat.start + beat.duration) {
        activeBeat = beat;
        activeIndex = i;
        break;
      }
    }

    if (activeBeat && activeIndex !== this.currentBeatIndex) {
      // New beat hit!
      this.currentBeatIndex = activeIndex;
      this.lastBeatTime = activeBeat.start;
      
      // Calculate beat pulse intensity driven by beat confidence & track energy
      const energy = this.audioFeatures ? this.audioFeatures.energy : 0.6;
      this.beatScale = 1.0 + (0.35 * activeBeat.confidence * energy * this.sensitivity);
    }

    // Decay beat progress and scale exponentially
    if (activeBeat) {
      const elapsed = this.currentProgress - this.lastBeatTime;
      this.beatProgress = Math.min(1.0, elapsed / activeBeat.duration);
      this.beatScale = THREE.MathUtils.lerp(this.beatScale, 1.0, 0.15);
    } else {
      this.beatScale = THREE.MathUtils.lerp(this.beatScale, 1.0, 0.1);
      this.beatProgress = 1.0;
    }
  }

  private getActiveSegment(): SpotifySegment | null {
    if (!this.audioAnalysis || !this.audioAnalysis.segments || this.audioAnalysis.segments.length === 0) {
      // Procedural Fallback Segment (using track ID hash for song-specific visual signatures)
      const trackId = this.playbackState?.item?.id || 'procedural_default';
      const hash = this.getTrackHash(trackId);
      const tempo = 95 + (hash % 60);
      const beatInterval = 60.0 / tempo;
      const segmentInterval = beatInterval * 4; // change segment every musical bar (4 beats)
      const segmentIndex = Math.floor(this.currentProgress / segmentInterval);

      const segHash = hash + segmentIndex * 31;
      const pitches: number[] = [];
      const timbre: number[] = [];

      for (let k = 0; k < 12; k++) {
        // Deterministic pseudo-random note pitches
        pitches.push(0.1 + ((segHash + k * 17) % 9) * 0.1);
      }
      for (let k = 0; k < 12; k++) {
        // Deterministic pseudo-random timbre details
        timbre.push(((segHash + k * 29) % 200) - 100);
      }

      return {
        start: segmentIndex * segmentInterval,
        duration: segmentInterval,
        confidence: 0.8,
        loudness_start: -15,
        loudness_max_time: 0.1,
        loudness_max: -5 + (segHash % 6) * 0.8,
        loudness_end: -18,
        pitches,
        timbre
      };
    }
    
    const segments = this.audioAnalysis.segments;
    // Find active segment
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (this.currentProgress >= seg.start && this.currentProgress < seg.start + seg.duration) {
        return seg;
      }
    }
    return null;
  }

  private render2d(): void {
    if (!this.ctx) return;
    const canvas2d = this.canvas2dRef.nativeElement;
    const width = canvas2d.width;
    const height = canvas2d.height;

    // Clear with slight trailing opacity for motion blur
    this.ctx.fillStyle = 'rgba(5, 6, 8, 0.2)';
    this.ctx.fillRect(0, 0, width, height);

    // Draw grid (except for oscilloscope which has its own lab grid)
    if (this.mode !== 'oscilloscope2d') {
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
      this.ctx.lineWidth = 1;
      for (let r = 1; r < 6; r++) {
        const gridY = (height / 6) * r;
        this.ctx.beginPath();
        this.ctx.moveTo(0, gridY);
        this.ctx.lineTo(width, gridY);
        this.ctx.stroke();
      }
      for (let c = 1; c < 10; c++) {
        const gridX = (width / 10) * c;
        this.ctx.beginPath();
        this.ctx.moveTo(gridX, 0);
        this.ctx.lineTo(gridX, height);
        this.ctx.stroke();
      }
    }

    if (this.mode === 'bars2d') {
      this.renderBars2d(width, height);
    } else if (this.mode === 'radial2d') {
      this.renderRadial2d(width, height);
    } else if (this.mode === 'oscilloscope2d') {
      this.renderOscilloscope2d(width, height);
    }
  }

  private renderBars2d(width: number, height: number): void {
    if (!this.ctx) return;
    const gap = 2;
    const barWidth = (width / this.numFftBars) - gap;

    // Draw Glow Gradient Bars
    for (let i = 0; i < this.numFftBars; i++) {
      const x = i * (barWidth + gap) + gap / 2;
      const barHeight = this.fftSmoothed[i] * height * 0.72;
      const y = height - barHeight - 12;

      if (barHeight > 2) {
        const gradient = this.ctx.createLinearGradient(x, y, x, height - 12);
        const hue = (135 + (i / this.numFftBars) * 190) % 360;
        gradient.addColorStop(0, `hsla(${hue}, 100%, 60%, 0.8)`);
        gradient.addColorStop(0.5, `hsla(${(hue + 30) % 360}, 95%, 50%, 0.25)`);
        gradient.addColorStop(1, `rgba(29, 185, 84, 0.01)`);

        this.ctx.fillStyle = gradient;
        this.drawRoundedRect(this.ctx, x, y, barWidth, barHeight, 3);
      }

      // Draw Peak indicator dots
      const peakHeight = this.fftPeaks[i] * height * 0.72;
      const peakY = height - peakHeight - 14;
      if (peakHeight > 2) {
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        this.ctx.fillRect(x, peakY, barWidth, 2);
      }
    }

    // Draw connecting Wave Line (FFT envelope)
    this.ctx.beginPath();
    this.ctx.lineWidth = 2.5;
    this.ctx.strokeStyle = 'hsla(140, 100%, 60%, 0.9)';
    this.ctx.shadowBlur = 10;
    this.ctx.shadowColor = 'rgba(29, 185, 84, 0.6)';

    for (let i = 0; i < this.numFftBars; i++) {
      const x = i * (barWidth + gap) + barWidth / 2 + gap / 2;
      const barHeight = this.fftSmoothed[i] * height * 0.72;
      const y = height - barHeight - 12;
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    this.ctx.stroke();
    this.ctx.shadowBlur = 0; // reset shadow

    // Draw Technical Measurement Labels
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    this.ctx.font = '9px monospace';
    this.ctx.fillText('+0 dB', 12, 18);
    this.ctx.fillText('-6 dB', 12, height * 0.22);
    this.ctx.fillText('-12 dB', 12, height * 0.42);
    this.ctx.fillText('-24 dB', 12, height * 0.62);

    this.ctx.fillText('20 Hz', 12, height - 2);
    this.ctx.fillText('100 Hz', width * 0.2, height - 2);
    this.ctx.fillText('500 Hz', width * 0.4, height - 2);
    this.ctx.fillText('2 kHz', width * 0.6, height - 2);
    this.ctx.fillText('8 kHz', width * 0.8, height - 2);
    this.ctx.fillText('20 kHz', width - 48, height - 2);
  }

  private renderRadial2d(width: number, height: number): void {
    if (!this.ctx) return;
    const centerX = width / 2;
    const centerY = height / 2;
    const baseRadius = Math.min(width, height) * 0.15 + (this.beatScale - 1.0) * 15;
    const maxLength = Math.min(width, height) * 0.24 * this.sensitivity;

    // Draw concentric technical rings
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    this.ctx.lineWidth = 1;
    for (let r = 1; r <= 3; r++) {
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, baseRadius + maxLength * 0.33 * r, 0, 2 * Math.PI);
      this.ctx.stroke();
    }

    // Draw radiating bars
    const numBars = this.numFftBars;
    const barAngle = (2 * Math.PI) / numBars;
    
    // Draw connecting wave loop (connecting ends of smoothed bars)
    this.ctx.beginPath();
    this.ctx.lineWidth = 2.0;
    this.ctx.strokeStyle = 'rgba(29, 185, 84, 0.85)';
    this.ctx.shadowBlur = 8;
    this.ctx.shadowColor = 'rgba(29, 185, 84, 0.5)';

    for (let i = 0; i < numBars; i++) {
      const angle = i * barAngle - Math.PI / 2;
      const targetRadius = baseRadius + this.fftSmoothed[i] * maxLength;
      const x = centerX + Math.cos(angle) * targetRadius;
      const y = centerY + Math.sin(angle) * targetRadius;
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    this.ctx.closePath();
    this.ctx.stroke();
    this.ctx.shadowBlur = 0; // reset

    // Draw the bars
    this.ctx.lineWidth = Math.max(1.5, (2 * Math.PI * baseRadius / numBars) * 0.6);
    for (let i = 0; i < numBars; i++) {
      const angle = i * barAngle - Math.PI / 2;
      const targetRadius = baseRadius + this.fftSmoothed[i] * maxLength;
      
      const xStart = centerX + Math.cos(angle) * baseRadius;
      const yStart = centerY + Math.sin(angle) * baseRadius;
      const xEnd = centerX + Math.cos(angle) * targetRadius;
      const yEnd = centerY + Math.sin(angle) * targetRadius;

      // Color based on angle
      const hue = (140 + (i / numBars) * 220) % 360;
      this.ctx.strokeStyle = `hsla(${hue}, 100%, 60%, 0.7)`;
      
      this.ctx.beginPath();
      this.ctx.moveTo(xStart, yStart);
      this.ctx.lineTo(xEnd, yEnd);
      this.ctx.stroke();

      // Peak dots
      const peakRadius = baseRadius + this.fftPeaks[i] * maxLength;
      const xPeak = centerX + Math.cos(angle) * peakRadius;
      const yPeak = centerY + Math.sin(angle) * peakRadius;
      
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      this.ctx.beginPath();
      this.ctx.arc(xPeak, yPeak, 1.5, 0, 2 * Math.PI);
      this.ctx.fill();
    }

    // Inner glowing core
    const coreGradient = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, baseRadius);
    coreGradient.addColorStop(0, 'rgba(29, 185, 84, 0.25)');
    coreGradient.addColorStop(0.7, 'rgba(138, 43, 226, 0.05)');
    coreGradient.addColorStop(1, 'rgba(5, 6, 8, 0.9)');
    
    this.ctx.fillStyle = coreGradient;
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, baseRadius, 0, 2 * Math.PI);
    this.ctx.fill();

    // Core border line
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, baseRadius, 0, 2 * Math.PI);
    this.ctx.stroke();
    
    // Core label
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    this.ctx.font = '8px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('LIVE FFT', centerX, centerY - 2);
    this.ctx.fillText('RADIAL', centerX, centerY + 8);
    this.ctx.textAlign = 'left'; // reset
  }

  private renderOscilloscope2d(width: number, height: number): void {
    if (!this.ctx) return;
    const centerY = height / 2;

    // Draw Laboratory Green Grid
    this.ctx.strokeStyle = 'rgba(0, 255, 100, 0.08)';
    this.ctx.lineWidth = 0.5;
    const gridRows = 8;
    for (let r = 1; r < gridRows; r++) {
      const gridY = (height / gridRows) * r;
      this.ctx.beginPath();
      if (r === gridRows / 2) {
        this.ctx.strokeStyle = 'rgba(0, 255, 100, 0.25)'; // thick center line
        this.ctx.lineWidth = 1;
      } else {
        this.ctx.strokeStyle = 'rgba(0, 255, 100, 0.08)';
        this.ctx.lineWidth = 0.5;
      }
      this.ctx.moveTo(0, gridY);
      this.ctx.lineTo(width, gridY);
      this.ctx.stroke();
    }
    const gridCols = 10;
    for (let c = 1; c < gridCols; c++) {
      const gridX = (width / gridCols) * c;
      this.ctx.beginPath();
      if (c === gridCols / 2) {
        this.ctx.strokeStyle = 'rgba(0, 255, 100, 0.25)'; // thick center line
        this.ctx.lineWidth = 1;
      } else {
        this.ctx.strokeStyle = 'rgba(0, 255, 100, 0.08)';
        this.ctx.lineWidth = 0.5;
      }
      this.ctx.moveTo(gridX, 0);
      this.ctx.lineTo(gridX, height);
      this.ctx.stroke();
    }

    // Reticle ticks on center lines
    this.ctx.strokeStyle = 'rgba(0, 255, 100, 0.4)';
    this.ctx.lineWidth = 1;
    const tickLen = 4;
    const centerX = width / 2;
    for (let x = 0; x < width; x += 10) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, centerY - tickLen / 2);
      this.ctx.lineTo(x, centerY + tickLen / 2);
      this.ctx.stroke();
    }
    for (let y = 0; y < height; y += 10) {
      this.ctx.beginPath();
      this.ctx.moveTo(centerX - tickLen / 2, y);
      this.ctx.lineTo(centerX + tickLen / 2, y);
      this.ctx.stroke();
    }

    // Plot timeDomainRaw waveform
    if (this.timeDomainRaw.length > 0) {
      this.ctx.beginPath();
      this.ctx.lineWidth = 2.0;
      this.ctx.strokeStyle = 'rgba(0, 255, 160, 0.9)';
      this.ctx.shadowBlur = 12;
      this.ctx.shadowColor = 'rgba(0, 255, 100, 0.7)';

      const sliceWidth = width / this.timeDomainRaw.length;
      for (let i = 0; i < this.timeDomainRaw.length; i++) {
        const x = i * sliceWidth;
        const y = centerY + this.timeDomainRaw[i] * centerY * 0.72;
        if (i === 0) {
          this.ctx.moveTo(x, y);
        } else {
          this.ctx.lineTo(x, y);
        }
      }
      this.ctx.stroke();
      this.ctx.shadowBlur = 0; // reset
    }

    // Oscilloscope Text Readouts
    this.ctx.fillStyle = 'rgba(0, 255, 100, 0.7)';
    this.ctx.font = '10px monospace';
    this.ctx.fillText('CH1 200mV', 16, 22);
    this.ctx.fillText('M 2.5ms', 100, 22);
    this.ctx.fillText('A CH1 30mV', 180, 22);

    const statusText = (this.playbackState && this.playbackState.is_playing) ? 'RUN' : 'STOP';
    this.ctx.fillText(statusText, width - 64, 22);
    this.ctx.fillText('TRIG AUTO', width - 78, height - 16);

    if (this.playbackState && this.playbackState.item) {
      this.ctx.fillText(`F_TRK: ${this.playbackState.item.name.substring(0, 16).toUpperCase()}`, 16, height - 16);
    } else {
      this.ctx.fillText('F_TRK: PROCEDURAL_GEN', 16, height - 16);
    }
  }

  private drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }

  private render3d(): void {
    const elapsed = this.clock.getElapsedTime();
    const energy = this.audioFeatures ? this.audioFeatures.energy : 0.6;
    const tempo = this.audioFeatures ? this.audioFeatures.tempo : 120;
    
    // Rotate scene elements base on tempo and overall energy
    const rotationSpeed = (tempo / 60) * 0.15 * (0.5 + energy * 0.5);

    // Hide all objects by default, only reveal active mode objects
    this.pulseSphere.visible = false;
    this.sphereWireframe.visible = false;
    this.particleSystem.visible = false;
    this.gridCubes.forEach(c => c.visible = false);
    if (this.waterfallMesh) {
      this.waterfallMesh.visible = false;
    }
    if (this.symphonyGroup) {
      this.symphonyGroup.visible = false;
    }

    // Precalculate frequency averages for 3D modes
    let bassAvg = 0;
    let midAvg = 0;
    let trebleAvg = 0;
    for (let i = 0; i < 6; i++) bassAvg += this.fftSmoothed[i] || 0;
    for (let i = 6; i < 30; i++) midAvg += this.fftSmoothed[i] || 0;
    for (let i = 30; i < 64; i++) trebleAvg += this.fftSmoothed[i] || 0;
    bassAvg /= 6;
    midAvg /= 24;
    trebleAvg /= 34;

    if (this.mode === 'sphere3d') {
      // Reset Camera
      this.camera.position.set(0, 0, 20);
      this.camera.lookAt(0, 0, 0);

      this.pulseSphere.visible = true;
      this.sphereWireframe.visible = true;

      // 1. Deform the sphere geometry dynamically using real-time FFT frequencies!
      if (this.sphereOriginalPositions && this.pulseSphere.geometry.attributes['position']) {
        const positions = this.pulseSphere.geometry.attributes['position'].array as Float32Array;
        const count = positions.length;

        for (let i = 0; i < count; i += 3) {
          const origX = this.sphereOriginalPositions[i];
          const origY = this.sphereOriginalPositions[i + 1];
          const origZ = this.sphereOriginalPositions[i + 2];

          // Compute direction vector (normalized original vertex position)
          const dist = Math.sqrt(origX*origX + origY*origY + origZ*origZ);
          if (dist === 0) continue;

          const nx = origX / dist;
          const ny = origY / dist;
          const nz = origZ / dist;

          // Map the vertex index to one of the 64 FFT bands
          const vertexIdx = i / 3;
          const binIdx = vertexIdx % 64;
          const freqVal = this.fftSmoothed[binIdx] || 0;

          // Compute deformation: low frequencies cause radial pulses, high frequencies add ripples/vibration
          const wavePhase = elapsed * 3.0 + vertexIdx * 0.1;
          const ripple = Math.sin(wavePhase) * freqVal * 0.8 * this.sensitivity;
          const bassPulse = bassAvg * 1.2 * this.sensitivity;
          let displacement = bassPulse + ripple;
          if (isNaN(displacement)) {
            displacement = 0.0;
          }

          positions[i] = origX + nx * displacement;
          positions[i + 1] = origY + ny * displacement;
          positions[i + 2] = origZ + nz * displacement;
        }
        this.pulseSphere.geometry.attributes['position'].needsUpdate = true;
        this.pulseSphere.geometry.computeVertexNormals(); // Recompute normals so shading is dynamic
        this.pulseSphere.geometry.computeBoundingSphere(); // Update bounds to prevent frustum culling
        this.pulseSphere.geometry.computeBoundingBox(); // Update bounding box
      }

      // Apply pulsing scale driven by bass & mid ranges to the wireframe
      const wireScale = 1.05 + midAvg * 0.9 * this.sensitivity;
      this.sphereWireframe.scale.setScalar(wireScale);

      // Rotations modulated by treble
      const speedMultiplier = 1.0 + trebleAvg * 3.0;
      this.pulseSphere.rotation.y = elapsed * rotationSpeed * speedMultiplier;
      this.pulseSphere.rotation.x = elapsed * rotationSpeed * 0.5 * speedMultiplier;

      this.sphereWireframe.rotation.y = -elapsed * rotationSpeed * 0.7 * speedMultiplier;
      this.sphereWireframe.rotation.z = elapsed * rotationSpeed * 0.3 * speedMultiplier;

      // Dynamic color interpolation using HSL (ensures bright neon colors that pulse to beats)
      const baseMat = this.pulseSphere.material as THREE.MeshPhongMaterial;
      const wireMat = this.sphereWireframe.material as THREE.LineBasicMaterial;
      
      let baseHue = (elapsed * 0.05 + bassAvg * 0.2) % 1.0;
      if (isNaN(baseHue)) baseHue = 0.0;
      let lightness = 0.35 + bassAvg * 0.35; // always at least 0.35 bright
      if (isNaN(lightness)) lightness = 0.35;
      
      baseMat.color.setHSL(baseHue, 0.9, lightness);
      
      let emissiveLight = bassAvg * 0.25;
      if (isNaN(emissiveLight)) emissiveLight = 0.0;
      baseMat.emissive.setHSL((baseHue + 0.5) % 1.0, 0.8, emissiveLight);
      
      let wireHue = (baseHue + 0.33) % 1.0;
      if (isNaN(wireHue)) wireHue = 0.33;
      let wireLight = 0.55 + midAvg * 0.3;
      if (isNaN(wireLight)) wireLight = 0.55;
      wireMat.color.setHSL(wireHue, 0.95, wireLight);

    } else if (this.mode === 'particles3d') {
      // Reset Camera
      this.camera.position.set(0, 0, 20);
      this.camera.lookAt(0, 0, 0);

      this.particleSystem.visible = true;

      const speedMultiplier = 1.0 + bassAvg * 2.0;
      this.particleSystem.rotation.y = elapsed * rotationSpeed * 0.3 * speedMultiplier;
      this.particleSystem.rotation.x = elapsed * rotationSpeed * 0.1 * speedMultiplier;

      const positions = this.particleSystem.geometry.attributes['position'].array as Float32Array;
      const count = positions.length;

      // Pulsate particle distances based on real FFT bands
      for (let i = 0; i < count; i += 3) {
        const origX = this.particlesOriginalPositions[i];
        const origY = this.particlesOriginalPositions[i + 1];
        const origZ = this.particlesOriginalPositions[i + 2];

        const dist = Math.sqrt(origX * origX + origY * origY + origZ * origZ);
        if (dist === 0) continue;
        const angle = Math.atan2(origY, origX) + 0.005 * energy * elapsed;
        
        // Map particle index to a frequency bin
        const binIndex = Math.floor((i / count) * 64) % 64;
        const freqVal = this.fftSmoothed[binIndex] || 0;
        
        // Vibrate particles based on high frequencies, expand on bass
        const radius = dist * (1.0 + freqVal * 0.05 * this.sensitivity + (this.beatScale - 1.0) * 0.01 * Math.sin(elapsed + i));

        positions[i] = radius * Math.cos(angle);
        positions[i + 1] = radius * Math.sin(angle);
        positions[i + 2] = origZ;
      }
      this.particleSystem.geometry.attributes['position'].needsUpdate = true;

      const mat = this.particleSystem.material as THREE.PointsMaterial;
      mat.size = 0.12 + midAvg * 0.4 * this.sensitivity;

    } else if (this.mode === 'grid3d') {
      const gridCount = this.gridCubes.length;

      // Slowly rotate camera/view to look from angle
      this.camera.position.x = Math.sin(elapsed * 0.1) * 18;
      this.camera.position.z = Math.cos(elapsed * 0.1) * 18;
      this.camera.position.y = 12 + Math.sin(elapsed * 0.2) * 3;
      this.camera.lookAt(0, 0, 0);

      for (let i = 0; i < gridCount; i++) {
        const cube = this.gridCubes[i];
        cube.visible = true;

        // Map the 8x8 grid cubes directly to the 64 FFT bands!
        const heightVal = this.fftSmoothed[i] || 0;

        // Apply scale & position
        const targetScaleY = Math.max(0.2, heightVal * 7.5 * this.sensitivity);
        
        // Smooth interpolation of scale
        cube.scale.y = THREE.MathUtils.lerp(cube.scale.y, targetScaleY, 0.25);
        cube.position.y = cube.scale.y / 2; // Keep base anchored on grid plane (y=0)

        // Light color modulation on beats
        const mat = cube.material as THREE.MeshPhongMaterial;
        mat.emissive.setHSL((i / gridCount + elapsed * 0.05) % 1.0, 0.8, 0.1 + heightVal * 0.3);
      }
    } else if (this.mode === 'waterfall3d' && this.waterfallMesh) {
      this.waterfallMesh.visible = true;

      // Setup Camera for Waterfall perspective looking down a scrolling canyon
      this.camera.position.set(0, 10, 16);
      this.camera.lookAt(0, -1, -2);

      // Average the 64 bins into 30 cols
      const newRow: number[] = [];
      const binsPerCol = 64 / this.numWaterfallCols;
      for (let c = 0; c < this.numWaterfallCols; c++) {
        let sum = 0;
        const startBin = Math.floor(c * binsPerCol);
        const endBin = Math.floor((c + 1) * binsPerCol);
        for (let b = startBin; b < endBin; b++) {
          sum += this.fftSmoothed[b] || 0;
        }
        newRow.push(sum / (endBin - startBin || 1));
      }

      // Add to history and scroll
      this.waterfallHistory.unshift(newRow);
      if (this.waterfallHistory.length > this.maxWaterfallRows) {
        this.waterfallHistory.pop();
      }

      // Update Plane geometry positions and colors
      const positions = this.waterfallGeometry.attributes['position'].array as Float32Array;
      const colors = this.waterfallGeometry.attributes['color'].array as Float32Array;

      for (let r = 0; r < this.maxWaterfallRows; r++) {
        const rowData = this.waterfallHistory[r] || new Array(this.numWaterfallCols).fill(0);
        for (let c = 0; c < this.numWaterfallCols; c++) {
          const vertexIndex = r * this.numWaterfallCols + c;
          const val = rowData[c] || 0;

          // Set height (y coordinate)
          positions[vertexIndex * 3 + 1] = val * 6.0 * this.sensitivity;

          // Color based on height and depth row
          const colorIdx = vertexIndex * 3;
          const heightRatio = Math.min(1.0, val * 1.5);
          const rowRatio = r / this.maxWaterfallRows;

          // HSL color: shifts from green/cyan (front/intense) to blue/purple (back/mild)
          const hue = (0.35 + heightRatio * 0.45 - rowRatio * 0.25) % 1.0;
          const color = new THREE.Color().setHSL(hue, 0.95, 0.15 + heightRatio * 0.4 * (1.0 - rowRatio * 0.5));

          colors[colorIdx] = color.r;
          colors[colorIdx + 1] = color.g;
          colors[colorIdx + 2] = color.b;
        }
      }
      this.waterfallGeometry.attributes['position'].needsUpdate = true;
      this.waterfallGeometry.attributes['color'].needsUpdate = true;
    } else if (this.mode === 'symphony3d') {
      this.camera.position.set(0, 4, 22);
      this.camera.lookAt(0, 0, 0);

      if (this.symphonyGroup) {
        this.symphonyGroup.visible = true;
      }

      let bassAvg = 0;
      let lowMidAvg = 0;
      let midAvg = 0;
      let highMidAvg = 0;
      let trebleAvg = 0;

      for (let i = 0; i < 4; i++) bassAvg += this.fftSmoothed[i] || 0;
      for (let i = 4; i < 12; i++) lowMidAvg += this.fftSmoothed[i] || 0;
      for (let i = 12; i < 28; i++) midAvg += this.fftSmoothed[i] || 0;
      for (let i = 28; i < 48; i++) highMidAvg += this.fftSmoothed[i] || 0;
      for (let i = 48; i < 64; i++) trebleAvg += this.fftSmoothed[i] || 0;

      bassAvg /= 4;
      lowMidAvg /= 8;
      midAvg /= 16;
      highMidAvg /= 20;
      trebleAvg /= 16;

      const coreScale = 1.0 + bassAvg * 1.8 * this.sensitivity;
      this.symphonyCore.scale.set(coreScale, coreScale, coreScale);
      
      this.symphonyCore.rotation.y = elapsed * 0.4;
      this.symphonyCore.rotation.x = elapsed * 0.2;

      const coreMat = this.symphonyCore.material as THREE.MeshPhongMaterial;
      const coreHue = (0.33 + bassAvg * 0.3) % 1.0;
      coreMat.color.setHSL(coreHue, 0.9, 0.4 + bassAvg * 0.2);
      coreMat.emissive.setHSL((coreHue + 0.5) % 1.0, 0.8, bassAvg * 0.4);

      this.symphonyRings.forEach((ring, idx) => {
        const speed = (0.3 + idx * 0.2) * (1.0 + lowMidAvg * 2.0);
        if (idx === 0) ring.rotation.z = elapsed * speed;
        if (idx === 1) ring.rotation.x = elapsed * speed;
        if (idx === 2) ring.rotation.y = elapsed * speed;

        const ringScale = 1.0 + lowMidAvg * 0.4 * this.sensitivity;
        ring.scale.set(ringScale, ringScale, ringScale);

        const ringMat = ring.material as THREE.MeshPhongMaterial;
        const currentHSL = { h: 0, s: 0, l: 0 };
        ringMat.color.getHSL(currentHSL);
        ringMat.color.setHSL(currentHSL.h, 0.9, 0.4 + lowMidAvg * 0.3);
      });

      const crystalCount = this.symphonyMelodyCrystals.length;
      for (let i = 0; i < crystalCount; i++) {
        const crystal = this.symphonyMelodyCrystals[i];
        
        const baseAngle = (i / crystalCount) * Math.PI * 2;
        const orbitAngle = baseAngle + elapsed * 0.25 + midAvg * 0.5;
        const orbitRadius = 7.0 + Math.sin(elapsed * 0.8 + i) * 0.8;

        const x = Math.cos(orbitAngle) * orbitRadius;
        const z = Math.sin(orbitAngle) * orbitRadius;
        const y = Math.sin(elapsed * 1.5 + i * 2.0) * 1.8 + Math.cos(orbitAngle * 2.0) * midAvg * 3.0 * this.sensitivity;

        crystal.position.set(x, y, z);

        crystal.rotation.y = -orbitAngle + Math.PI / 2;
        crystal.rotation.x = elapsed * 1.2;

        const crystalScale = 0.8 + midAvg * 1.2 * this.sensitivity;
        crystal.scale.set(crystalScale, crystalScale, crystalScale);

        const crysMat = crystal.material as THREE.MeshPhongMaterial;
        const currentHSL = { h: 0, s: 0, l: 0 };
        crysMat.color.getHSL(currentHSL);
        crysMat.emissive.setHSL(currentHSL.h, 0.8, midAvg * 0.4);
      }

      const starCount = this.symphonyPercussionStars.length;
      for (let i = 0; i < starCount; i++) {
        const star = this.symphonyPercussionStars[i];
        
        const angle = (i / starCount) * Math.PI * 2 + elapsed * 0.08;
        const radius = 10.5;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = Math.sin(elapsed * 3.0 + i) * 0.5;
        star.position.set(x, y, z);

        star.rotation.x = elapsed * 2.0 + i;
        star.rotation.y = elapsed * 1.0;

        const fftIdx = 48 + (i % 16);
        const starFreq = this.fftSmoothed[fftIdx] || 0;

        const starScale = 0.5 + starFreq * 3.5 * this.sensitivity;
        star.scale.set(starScale, starScale, starScale);

        const starMat = star.material as THREE.MeshPhongMaterial;
        if (starFreq > 0.45) {
          starMat.color.setHex(0xff3300);
          starMat.emissive.setHex(0xff3300);
        } else if (starFreq > 0.25) {
          starMat.color.setHex(0xffd700);
          starMat.emissive.setHex(0xffd700);
        } else {
          starMat.color.setHex(0xaaaaaa);
          starMat.emissive.setHex(0x222222);
        }
      }

      this.symphonyAtmosphere.rotation.y = elapsed * 0.03;
      this.symphonyAtmosphere.rotation.z = -elapsed * 0.015;

      const starPointsMat = this.symphonyAtmosphere.material as THREE.PointsMaterial;
      starPointsMat.size = 0.12 + highMidAvg * 0.2 * this.sensitivity;
      starPointsMat.opacity = 0.4 + highMidAvg * 0.5;
    }

    // Dynamic Point Light behavior
    this.pointLight.position.x = Math.sin(elapsed * 1.5) * 8;
    this.pointLight.position.z = Math.cos(elapsed * 1.5) * 8;
    this.pointLight.intensity = 1.5 + bassAvg * 8.0;

    this.renderer.render(this.scene, this.camera);
  }

  private disposeThreeJs(): void {
    // Clean up Three.js WebGL bindings to avoid memory leaks
    if (this.renderer) {
      this.renderer.dispose();
    }
    
    if (this.pulseSphere) {
      this.pulseSphere.geometry.dispose();
      (this.pulseSphere.material as THREE.Material).dispose();
    }

    if (this.sphereWireframe) {
      this.sphereWireframe.geometry.dispose();
      (this.sphereWireframe.material as THREE.Material).dispose();
    }

    if (this.particleSystem) {
      this.particleSystem.geometry.dispose();
      (this.particleSystem.material as THREE.Material).dispose();
    }

    this.gridCubes.forEach(cube => {
      cube.geometry.dispose();
      (cube.material as THREE.Material).dispose();
    });
    this.gridCubes = [];

    if (this.waterfallMesh) {
      this.waterfallMesh.geometry.dispose();
      (this.waterfallMesh.material as THREE.Material).dispose();
    }

    if (this.symphonyGroup) {
      this.scene.remove(this.symphonyGroup);
      
      if (this.symphonyCore) {
        this.symphonyCore.geometry.dispose();
        (this.symphonyCore.material as THREE.Material).dispose();
      }

      this.symphonyRings.forEach(ring => {
        ring.geometry.dispose();
        (ring.material as THREE.Material).dispose();
      });

      this.symphonyMelodyCrystals.forEach(crystal => {
        crystal.geometry.dispose();
        (crystal.material as THREE.Material).dispose();
      });

      this.symphonyPercussionStars.forEach(star => {
        star.geometry.dispose();
        (star.material as THREE.Material).dispose();
      });

      if (this.symphonyAtmosphere) {
        this.symphonyAtmosphere.geometry.dispose();
        (this.symphonyAtmosphere.material as THREE.Material).dispose();
      }
    }
  }
}
