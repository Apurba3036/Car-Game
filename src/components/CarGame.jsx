import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import carImg from '../assets/image.png';
import batmobileImg from '../assets/image copy 4.png';
import { FaArrowLeft, FaArrowRight, FaArrowUp, FaArrowDown, FaPlay, FaRedo, FaVolumeMute, FaVolumeUp } from 'react-icons/fa';
import { GiTrophyCup } from 'react-icons/gi';

// AUDIO IMPORTS
import musicMenu from '../assets/mfcc-speed-speed-racing-cycling-music-257904.mp3';
import musicRace1 from '../assets/lnplusmusic-racing-speed-driving-music-416549.mp3';
import musicRace2 from '../assets/mfcc-speed-speed-racing-cycling-music-257904.mp3';
import sfxCoin from '../assets/point collection.mp3';
import sfxFire from '../assets/fire collection.mp3';
import sfxClick from '../assets/mouse click.mp3';

const CarGame = () => {
    const canvasRef = useRef(null);
    const [gameState, setGameState] = useState('START');
    const [score, setScore] = useState(0);
    const [lives, setLives] = useState(3);
    const [timeLeft, setTimeLeft] = useState(180);
    const [countDown, setCountDown] = useState(3);
    const [zoneName, setZoneName] = useState('NATURE');
    const [showZoneNotify, setShowZoneNotify] = useState(false);
    const [showQuitConfirm, setShowQuitConfirm] = useState(false);
    const [currentSpeed, setCurrentSpeed] = useState(0);
    // Racing mode state
    const [raceDistance, setRaceDistance] = useState(0);
    const [opponentPosition, setOpponentPosition] = useState(0);
    const [raceTime, setRaceTime] = useState(0);

    // Refs
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const rendererRef = useRef(null);
    const composerRef = useRef(null);
    const carRef = useRef(null);
    const roadSegments = useRef([]);
    const coins = useRef([]);
    const fires = useRef([]);
    const activeKeys = useRef({});
    const animationRef = useRef(null);
    const speedRef = useRef(0);
    const envZone = useRef('NATURE');
    const opponentRef = useRef(null);
    const opponentSpeedRef = useRef(0);
    const rainParticles = useRef([]);
    const groundRef = useRef(null);
    const defaultCarTex = useRef(null);
    const batmobileTex = useRef(null);

    const createAudio = (src, loop = false) => {
        const a = new Audio(src);
        a.preload = 'auto';
        a.loop = loop;
        return a;
    };

    // Audio Refs
    const audioMenuRef = useRef(createAudio(musicMenu, true));
    const audioRace1Ref = useRef(createAudio(musicRace1));
    const audioRace2Ref = useRef(createAudio(musicRace2));
    const audioCoinRef = useRef(createAudio(sfxCoin));
    const audioFireRef = useRef(createAudio(sfxFire));
    const audioClickRef = useRef(createAudio(sfxClick));
    const currentRaceTrack = useRef(1);

    // Constants
    const SEGMENT_LENGTH = 100;
    const NUM_SEGMENTS = 14;
    const CAR_SPEED_MAX = 2.8;
    const ROAD_WIDTH = 28;
    const LANE_WIDTH = 7;

    const [audioEnabled, setAudioEnabled] = useState(false);

    useEffect(() => {
        // AUDIO MANAGEMENT
        const menuAudio = audioMenuRef.current;
        const race1 = audioRace1Ref.current;
        const race2 = audioRace2Ref.current;

        menuAudio.loop = true;
        race1.onended = () => { race1.currentTime = 0; race2.play(); currentRaceTrack.current = 2; };
        race2.onended = () => { race2.currentTime = 0; race1.play(); currentRaceTrack.current = 1; };

        audioCoinRef.current.volume = 0.6;
        audioFireRef.current.volume = 0.8;

        const stopAll = () => {
            menuAudio.pause(); menuAudio.currentTime = 0;
            race1.pause(); race1.currentTime = 0;
            race2.pause(); race2.currentTime = 0;
        };

        if (gameState === 'START') {
            stopAll();
            menuAudio.volume = 0.5;
            const playPromise = menuAudio.play();
            if (playPromise !== undefined) {
                playPromise.then(() => setAudioEnabled(true)).catch(error => {
                    console.log("Autoplay prevented.");
                    setAudioEnabled(false);
                });
            }
        } else if (gameState === 'COUNTDOWN') {
            stopAll();
        } else if (gameState === 'PLAYING') {
            if (race1.paused && race2.paused) {
                race1.volume = 0.4; race2.volume = 0.4;
                race1.play(); currentRaceTrack.current = 1;
            }
        } else if (gameState === 'GAME_OVER') {
            stopAll();
        }
    }, [gameState]);

    const enableAudio = () => {
        if (!audioEnabled) {
            console.log("Unlocking audio context...");
            // Standard unlock: Play all sounds briefly (silent or immediately paused)
            const unlock = (a) => {
                a.volume = 0;
                a.play().then(() => {
                    a.pause();
                    a.volume = 1;
                }).catch(e => console.log("Unlock failed for sound:", e));
            };

            unlock(audioMenuRef.current);
            unlock(audioRace1Ref.current);
            unlock(audioRace2Ref.current);
            unlock(audioCoinRef.current);
            unlock(audioFireRef.current);
            unlock(audioClickRef.current);

            // Special case for menu music - restart it properly
            audioMenuRef.current.volume = 0.5;
            audioMenuRef.current.play().catch(e => { });

            setAudioEnabled(true);
        }
    };

    const playSFX = (ref) => {
        if (ref.current) {
            ref.current.currentTime = 0;
            ref.current.play().catch(e => console.error("SFX Play Error:", e));
        }
    };

    const playClick = () => playSFX(audioClickRef);

    useEffect(() => {
        window.addEventListener('click', enableAudio);
        return () => window.removeEventListener('click', enableAudio);
    }, [gameState, audioEnabled]);

    useEffect(() => {
        // SCENE SETUP (Only if not already created)
        if (sceneRef.current) return;

        const scene = new THREE.Scene();
        const skyColor = envZone.current === 'RACING' ? 0x01010a : 0x4a6fa5;
        scene.background = new THREE.Color(skyColor);
        scene.fog = new THREE.FogExp2(skyColor, 0.002);
        scene.fog = new THREE.Fog(skyColor, 40, 350);

        // CAMERA - DYNAMIC POSITION
        const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);

        // Initial responsive setup
        const isMobile = window.innerWidth < 768;
        const isPortrait = window.innerHeight > window.innerWidth;
        // Adjusted camera for mobile/portrait to show more of the environment
        camera.position.set(0, isMobile ? 9 : 6, isPortrait ? -35 : (isMobile ? -25 : -15));
        camera.lookAt(0, 0, 25);

        // RENDERER
        const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: false });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;

        // POST-PROCESSING
        const renderScene = new RenderPass(scene, camera);
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
        bloomPass.threshold = 0.6;
        bloomPass.strength = 0.4;
        bloomPass.radius = 0.3;

        const composer = new EffectComposer(renderer);
        composer.addPass(renderScene);
        composer.addPass(bloomPass);
        composerRef.current = composer;

        // LIGHTING
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffebd7, 1.2);
        dirLight.position.set(50, 80, -30);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 4096;
        dirLight.shadow.mapSize.height = 4096;
        scene.add(dirLight);

        // GROUND
        const groundGeo = new THREE.PlaneGeometry(2000, 2000);
        const groundMat = new THREE.MeshStandardMaterial({ color: 0x3b5e3b, roughness: 1, metalness: 0 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.1;
        ground.receiveShadow = true;
        scene.add(ground);
        groundRef.current = ground;

        // RAIN SETUP
        const setupRain = () => {
            const rainCount = 1000;
            const rainGeo = new THREE.BufferGeometry();
            const rainPos = new Float32Array(rainCount * 3);
            for (let i = 0; i < rainCount * 3; i += 3) {
                rainPos[i] = (Math.random() - 0.5) * 200;
                rainPos[i + 1] = Math.random() * 100;
                rainPos[i + 2] = (Math.random() - 0.5) * 400;
            }
            rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
            const rainMat = new THREE.LineBasicMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.4 });
            const rain = new THREE.Points(rainGeo, rainMat);
            rainParticles.current = rain;
            scene.add(rain);
        };
        setupRain();

        // PLAYER CAR (Sprite-based with Real-time Background Removal)
        const carGroup = new THREE.Group();

        const loadCarTexture = (src, callback) => {
            const img = new Image();
            img.src = src;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i], g = data[i + 1], b = data[i + 2];
                    const brightness = (r + g + b) / 3;
                    const chroma = Math.max(r, g, b) - Math.min(r, g, b);

                    // Backgrounds in the source images are usually neutral/grayish
                    // The Batmobile (image copy 3.png) has a brownish gray background
                    const isNeutralish = chroma < 35;

                    // Keep very light or neutral grounds transparent
                    // But preserve the car which is either very dark or colorful (red glows)
                    if (brightness > 230) {
                        data[i + 3] = 0;
                    } else if (isNeutralish && brightness > 35 && brightness < 210) {
                        data[i + 3] = 0;
                    }
                }
                ctx.putImageData(imageData, 0, 0);
                const tex = new THREE.CanvasTexture(canvas);
                tex.encoding = THREE.sRGBEncoding;
                callback(tex);
            };
        };

        loadCarTexture(carImg, (tex) => {
            defaultCarTex.current = tex;
            if (envZone.current !== 'GOTHAM') {
                carMesh.material.map = tex;
                carMesh.material.needsUpdate = true;
            }
        });

        loadCarTexture(batmobileImg, (tex) => {
            batmobileTex.current = tex;
            if (envZone.current === 'GOTHAM') {
                carMesh.material.map = tex;
                carMesh.material.needsUpdate = true;
            }
        });

        const spriteMat = new THREE.MeshStandardMaterial({
            transparent: true, alphaTest: 0.1,
            roughness: 0.4, metalness: 0.2, side: THREE.DoubleSide
        });
        const spriteGeo = new THREE.PlaneGeometry(5, 3);
        const carMesh = new THREE.Mesh(spriteGeo, spriteMat);
        carMesh.position.y = 1.5; carMesh.rotation.y = Math.PI;
        carMesh.castShadow = true; carMesh.receiveShadow = true;
        carGroup.add(carMesh);

        const shadowGeo = new THREE.PlaneGeometry(4, 2);
        const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 });
        const shadow = new THREE.Mesh(shadowGeo, shadowMat);
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = 0.05;
        carGroup.add(shadow);

        scene.add(carGroup);
        carRef.current = carGroup;

        scene.add(carGroup);
        carRef.current = carGroup;

        sceneRef.current = scene;
        cameraRef.current = camera;
        rendererRef.current = renderer;

        const handleResize = () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            const aspect = width / height;

            camera.aspect = aspect;

            // Adjust FOV slightly for portrait mode to help with horizontal visibility
            if (aspect < 1) {
                camera.fov = 65 + (1 - aspect) * 20; // Subtle increase to avoid fish-eye
            } else {
                camera.fov = 65;
            }
            camera.updateProjectionMatrix();

            const isMob = width < 768;
            const isPortrait = height > width;
            // Pull camera back further in portrait mode to show road edges
            camera.position.set(0, isMob ? 9 : 6, isPortrait ? -35 : (isMob ? -25 : -15));
            camera.lookAt(0, 0, 25);

            renderer.setSize(width, height);
            composer.setSize(width, height);
        };
        window.addEventListener('resize', handleResize);
        handleResize(); // Ensure initial camera state is correct for orientation

        // Initial Road
        for (let i = 0; i < NUM_SEGMENTS; i++) spawnSegment(i * SEGMENT_LENGTH);

        // CITY
        const cityGroup = new THREE.Group();
        const buildingMat = new THREE.MeshStandardMaterial({ color: 0x556677, roughness: 0.6 });
        const windowMat = new THREE.MeshBasicMaterial({ color: 0xffdd88 });

        for (let i = 0; i < 80; i++) {
            const h = 30 + Math.random() * 80;
            const w = 10 + Math.random() * 20;
            const d = 10 + Math.random() * 20;
            const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), buildingMat);
            const x = (Math.random() - 0.5) * 800;
            if (Math.abs(x) < 50) continue;
            b.position.set(x, h / 2 - 5, Math.random() * 800 - 200);
            b.receiveShadow = true;
            cityGroup.add(b);
        }
        scene.add(cityGroup);

        return () => {
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(animationRef.current);
            renderer.dispose();
            composer.dispose();
        };
    }, []);

    const spawnSegment = (zPos) => {
        const scene = sceneRef.current;
        const segmentGroup = new THREE.Group();
        segmentGroup.position.z = zPos;

        // ROAD
        const roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH, SEGMENT_LENGTH);
        const roadMat = new THREE.MeshStandardMaterial({
            color: envZone.current === 'RACING' ? 0x050505 : 0x222222,
            roughness: 0.1, metalness: 0.8
        });
        const road = new THREE.Mesh(roadGeo, roadMat);
        road.rotation.x = -Math.PI / 2;
        road.receiveShadow = true;
        segmentGroup.add(road);

        // Futuristic Grid for Road (only in RACING)
        if (envZone.current === 'RACING') {
            const grid = new THREE.GridHelper(ROAD_WIDTH, 4, 0x00ffff, 0x003333);
            grid.rotation.x = -Math.PI / 2;
            grid.position.y = 0.05;
            segmentGroup.add(grid);
        }

        // Lane Lines
        const lineGeo = new THREE.PlaneGeometry(0.8, 6);
        const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        for (let i = 0; i < SEGMENT_LENGTH; i += 15) {
            const isStartLine = envZone.current === 'RACING' && zPos < 20 && i < 30;
            const isFinishLine = envZone.current === 'RACING' && zPos > 24900 && zPos < 25100;
            const isMarker = isStartLine || isFinishLine;
            const lineMatLocal = isMarker ? new THREE.MeshBasicMaterial({ color: isFinishLine ? 0x000000 : 0xffffff }) : lineMat;
            const line = new THREE.Mesh(isMarker ? new THREE.PlaneGeometry(ROAD_WIDTH, 1.5) : lineGeo, lineMatLocal);
            line.rotation.x = -Math.PI / 2;
            line.position.set(0, 0.05, i - SEGMENT_LENGTH / 2);
            segmentGroup.add(line);

            if (isFinishLine) {
                // Add a second white line for checkerboard feel
                const lineCheck = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH, 0.75), new THREE.MeshBasicMaterial({ color: 0xffffff }));
                lineCheck.rotation.x = -Math.PI / 2;
                lineCheck.position.set(0, 0.06, i - SEGMENT_LENGTH / 2 + 0.75);
                segmentGroup.add(lineCheck);
            }
        }

        // Sidewalk
        const curbGeo = new THREE.BoxGeometry(1, 0.5, SEGMENT_LENGTH);
        const curbMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
        const curbL = new THREE.Mesh(curbGeo, curbMat);
        curbL.position.set(-(ROAD_WIDTH / 2 + 0.5), 0.25, 0);
        segmentGroup.add(curbL);
        const curbR = new THREE.Mesh(curbGeo, curbMat);
        curbR.position.set((ROAD_WIDTH / 2 + 0.5), 0.25, 0);
        segmentGroup.add(curbR);

        // Helper to get side position
        const getSidePos = (minDist = 18, maxDist = 40) => (minDist + Math.random() * (maxDist - minDist)) * (Math.random() > 0.5 ? 1 : -1);

        // NATURE PROPS
        if (envZone.current === 'NATURE' || envZone.current === 'TRANSITION') {
            if (envZone.current === 'NATURE') {
                // BIG TREES
                for (let i = 0; i < 4; i++) {
                    const tree = new THREE.Group();
                    const trunkH = 8 + Math.random() * 8;
                    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, trunkH), new THREE.MeshStandardMaterial({ color: 0x3d2b1f }));
                    trunk.position.y = trunkH / 2;
                    tree.add(trunk);

                    for (let j = 0; j < 3; j++) {
                        const leaves = new THREE.Mesh(
                            new THREE.DodecahedronGeometry(4 - j + Math.random()),
                            new THREE.MeshStandardMaterial({ color: 0x0a3d0a, flatShading: true })
                        );
                        leaves.position.y = trunkH + j * 2.5;
                        tree.add(leaves);
                    }
                    tree.position.set(getSidePos(20, 70), 0, Math.random() * SEGMENT_LENGTH - SEGMENT_LENGTH / 2);
                    segmentGroup.add(tree);
                }

                // SMALL COZY HOUSES
                if (Math.random() > 0.4) {
                    const house = new THREE.Group();
                    const base = new THREE.Mesh(new THREE.BoxGeometry(8, 6, 8), new THREE.MeshStandardMaterial({ color: 0x5a3a22 }));
                    base.position.y = 3;
                    house.add(base);
                    const roof = new THREE.Mesh(new THREE.ConeGeometry(7, 5, 4), new THREE.MeshStandardMaterial({ color: 0x883322 }));
                    roof.position.y = 8.5;
                    roof.rotation.y = Math.PI / 4;
                    house.add(roof);
                    // Light from windows
                    const windowLight = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ color: 0xffcc33 }));
                    windowLight.position.set(0, 3.5, 4.05);
                    house.add(windowLight);

                    house.position.set(getSidePos(30, 60), 0, Math.random() * SEGMENT_LENGTH - SEGMENT_LENGTH / 2);
                    house.rotation.y = Math.random() * Math.PI;
                    segmentGroup.add(house);
                }
            } else {
                // Transition Trees
                for (let i = 0; i < 2; i++) {
                    const tree = new THREE.Group();
                    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 4), new THREE.MeshStandardMaterial({ color: 0x5C4033 }));
                    trunk.position.y = 2;
                    tree.add(trunk);
                    const leaves = new THREE.Mesh(new THREE.DodecahedronGeometry(2.5), new THREE.MeshStandardMaterial({ color: 0x228B22, flatShading: true }));
                    leaves.position.y = 4.5;
                    tree.add(leaves);
                    tree.position.set(getSidePos(18, 50), 0, Math.random() * SEGMENT_LENGTH - SEGMENT_LENGTH / 2);
                    segmentGroup.add(tree);
                }
            }

            // Bushes & Rocks
            for (let i = 0; i < 3; i++) {
                const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2), new THREE.MeshStandardMaterial({ color: 0x1a5e1a, flatShading: true }));
                bush.position.set(getSidePos(14, 25), 0.5, Math.random() * SEGMENT_LENGTH - SEGMENT_LENGTH / 2);
                segmentGroup.add(bush);
            }
        }

        // CITY PROPS
        if (envZone.current === 'CITY' || envZone.current === 'TRANSITION') {
            const density = envZone.current === 'CITY' ? 3 : 1;

            // Street Lamps
            for (let i = 0; i < density; i++) {
                const lamp = new THREE.Group();
                const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 8), new THREE.MeshStandardMaterial({ color: 0x333333 }));
                pole.position.y = 4;
                lamp.add(pole);

                const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 0.8), new THREE.MeshStandardMaterial({ color: 0x333333 }));
                top.position.set(0.6, 7.8, 0);
                lamp.add(top);

                const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.3), new THREE.MeshBasicMaterial({ color: 0xffffaa }));
                bulb.position.set(1.2, 7.6, 0);
                lamp.add(bulb);

                const side = Math.random() > 0.5 ? 1 : -1;
                lamp.position.set(side * 14.5, 0, Math.random() * SEGMENT_LENGTH - SEGMENT_LENGTH / 2);
                lamp.rotation.y = side > 0 ? 0 : Math.PI;
                segmentGroup.add(lamp);
            }

            // Neon Billboards
            if (Math.random() > 0.4) {
                const bb = new THREE.Group();
                const frame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 12), new THREE.MeshStandardMaterial({ color: 0x111111 }));
                frame.position.y = 8;
                bb.add(frame);

                const colors = [0x00ffff, 0xff00ff, 0xffff00, 0x00ff00];
                const glow = new THREE.Mesh(
                    new THREE.PlaneGeometry(11, 5),
                    new THREE.MeshBasicMaterial({ color: colors[Math.floor(Math.random() * colors.length)], side: THREE.DoubleSide })
                );
                glow.position.set(0.3, 8, 0);
                glow.rotation.y = Math.PI / 2;
                bb.add(glow);

                const legs = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5, 0.3), new THREE.MeshStandardMaterial({ color: 0x222222 }));
                legs.position.y = 2.5;
                bb.add(legs);

                bb.position.set(getSidePos(25, 35), 0, Math.random() * SEGMENT_LENGTH - SEGMENT_LENGTH / 2);
                segmentGroup.add(bb);
            }

            // Buildings in the city zone
            if (envZone.current === 'CITY') {
                for (let i = 0; i < 4; i++) {
                    const h = 40 + Math.random() * 60;
                    const w = 15 + Math.random() * 15;
                    const b = new THREE.Mesh(
                        new THREE.BoxGeometry(w, h, w),
                        new THREE.MeshStandardMaterial({ color: 0x112233, roughness: 0.3, metalness: 0.8 })
                    );
                    const bX = getSidePos(40, 100);
                    b.position.set(bX, h / 2 - 2, Math.random() * SEGMENT_LENGTH - SEGMENT_LENGTH / 2);

                    // Add holographic screens / banners to buildings
                    const colors = [0x00ffff, 0xff00ff, 0xffff00, 0x00ff00, 0xff0000];
                    const sideSign = bX > 0 ? -1 : 1; // Face the road

                    // Big Screen
                    if (Math.random() > 0.3) {
                        const sW = w * 0.7;
                        const sH = h * 0.3;
                        const screen = new THREE.Mesh(
                            new THREE.PlaneGeometry(sW, sH),
                            new THREE.MeshBasicMaterial({ color: colors[Math.floor(Math.random() * colors.length)], side: THREE.DoubleSide })
                        );
                        screen.position.set(sideSign * (w / 2 + 0.1), Math.random() * (h / 2) - h / 4, 0);
                        screen.rotation.y = Math.PI / 2;
                        b.add(screen);

                        // Subtle glow frame
                        const frame = new THREE.Mesh(
                            new THREE.PlaneGeometry(sW + 1, sH + 1),
                            new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.2, transparent: true })
                        );
                        frame.position.set(sideSign * (w / 2 + 0.05), screen.position.y, 0);
                        frame.rotation.y = Math.PI / 2;
                        b.add(frame);
                    }

                    // Vertical Banner
                    if (Math.random() > 0.4) {
                        const banW = 2;
                        const banH = h * 0.6;
                        const banner = new THREE.Mesh(
                            new THREE.PlaneGeometry(banW, banH),
                            new THREE.MeshBasicMaterial({ color: colors[Math.floor(Math.random() * colors.length)], side: THREE.DoubleSide })
                        );
                        banner.position.set(sideSign * (w / 2 + 0.2), 0, (Math.random() - 0.5) * w * 0.5);
                        banner.rotation.y = Math.PI / 2;
                        b.add(banner);
                    }

                    segmentGroup.add(b);
                }
            }
        }

        // GOTHAM PROPS
        if (envZone.current === 'GOTHAM') {
            // Procedural Buildings
            for (let i = 0; i < 6; i++) {
                const h = 40 + Math.random() * 120;
                const w = 25 + Math.random() * 15;
                const b = new THREE.Mesh(
                    new THREE.BoxGeometry(w, h, w),
                    new THREE.MeshStandardMaterial({ color: 0x1a1a25, roughness: 0.1, metalness: 0.8 })
                );
                const bX = getSidePos(35, 100);
                b.position.set(bX, h / 2, Math.random() * SEGMENT_LENGTH - SEGMENT_LENGTH / 2);
                b.castShadow = true;
                b.receiveShadow = true;
                segmentGroup.add(b);

                // Street Lamps attached to buildings
                const lamp = new THREE.Group();
                const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 8), new THREE.MeshStandardMaterial({ color: 0x333333 }));
                pole.position.set(bX > 0 ? -w / 2 : w / 2, 8, 0);
                lamp.add(pole);
                const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5), new THREE.MeshBasicMaterial({ color: 0xffcc00 }));
                bulb.position.set(bX > 0 ? -w / 2 - 1 : w / 2 + 1, 12, 0);
                lamp.add(bulb);
                const pLight = new THREE.PointLight(0xffcc00, 50, 20);
                pLight.position.copy(bulb.position);
                lamp.add(pLight);
                segmentGroup.add(lamp);

                // Add grid windows for Gotham feel
                const winGeo = new THREE.BoxGeometry(w + 0.2, h * 0.9, w + 0.2);
                const winMat = new THREE.MeshBasicMaterial({
                    color: 0x00ffff,
                    transparent: true,
                    opacity: 0.05,
                    wireframe: true
                });
                const windows = new THREE.Mesh(winGeo, winMat);
                b.add(windows);
            }

            // Ground/Road Grid Visuals for Gotham
            const grid = new THREE.GridHelper(ROAD_WIDTH, 8, 0x00ffff, 0x003333);
            grid.rotation.x = -Math.PI / 2;
            grid.position.y = 0.05;
            segmentGroup.add(grid);

            // Orbs (Collectibles)
            const orbGeo = new THREE.SphereGeometry(1.2, 16, 16);
            const orbMat = new THREE.MeshBasicMaterial({ color: 0xff00ff });
            const itemZ = Math.random() * SEGMENT_LENGTH - SEGMENT_LENGTH / 2;
            const laneX = (Math.floor(Math.random() * 3) - 1) * LANE_WIDTH;

            const orb = new THREE.Mesh(orbGeo, orbMat);
            orb.position.set(laneX, 2, itemZ);
            orb.userData = { type: 'coin', value: 100, rotSpeed: 0.05 };
            segmentGroup.add(orb);
            coins.current.push(orb);
        }

        // RACING STADIUM PROPS
        if (envZone.current === 'RACING') {
            // High-Speed Maglev Train (Frequence increased to 50%)
            if (Math.random() > 0.5) {
                const trainGroup = new THREE.Group();
                const trainBody = new THREE.Mesh(
                    new THREE.BoxGeometry(4, 2, 25),
                    new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 1.0, roughness: 0.1 })
                );
                trainGroup.add(trainBody);

                // Neon Windows (More emissive)
                for (let i = -10; i <= 10; i += 4) {
                    const window = new THREE.Mesh(
                        new THREE.BoxGeometry(4.1, 0.8, 2),
                        new THREE.MeshBasicMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 5 })
                    );
                    window.position.set(0, 0.3, i);
                    trainGroup.add(window);
                }

                // Glowing Rails for the Train
                const rail = new THREE.Mesh(
                    new THREE.BoxGeometry(0.5, 0.5, SEGMENT_LENGTH),
                    new THREE.MeshBasicMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 2 })
                );
                rail.position.set(0, -2, (Math.random() - 0.5) * SEGMENT_LENGTH);
                trainGroup.add(rail);

                trainGroup.position.set(30, 4, (Math.random() - 0.5) * SEGMENT_LENGTH);
                trainGroup.userData.type = 'maglev';
                trainGroup.userData.speed = 3.5 + Math.random() * 3;
                segmentGroup.add(trainGroup);
            }

            // Flying Holographic Ships/Planes (Frequency increased to 40%)
            if (Math.random() > 0.6) {
                const shipGroup = new THREE.Group();
                const shipBody = new THREE.Mesh(
                    new THREE.ConeGeometry(3, 10, 4),
                    new THREE.MeshStandardMaterial({ color: 0x00ffff, transparent: true, opacity: 0.8, emissive: 0x00ffff, emissiveIntensity: 1.5 })
                );
                shipBody.rotation.x = Math.PI / 2;
                shipGroup.add(shipBody);

                // Blinking Lights (Larger and brighter)
                const light = new THREE.Mesh(new THREE.SphereGeometry(1.0), new THREE.MeshBasicMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 5 }));
                light.position.set(3, 0, 0);
                light.userData.type = 'blinker';
                shipGroup.add(light);

                const light2 = new THREE.Mesh(new THREE.SphereGeometry(1.0), new THREE.MeshBasicMaterial({ color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 5 }));
                light2.position.set(-3, 0, 0);
                light2.userData.type = 'blinker';
                shipGroup.add(light2);

                shipGroup.position.set((Math.random() - 0.5) * 120, 50 + Math.random() * 40, (Math.random() - 0.5) * SEGMENT_LENGTH);
                shipGroup.userData.type = 'ship';
                shipGroup.userData.speed = 2.0 + Math.random() * 2;
                segmentGroup.add(shipGroup);
            }

            // Monolithic Sky Creepers (Improved Skyscrapers)
            for (let side of [-1, 1]) {
                if (Math.random() > 0.3) {
                    const hScale = 40 + Math.random() * 100;
                    const towerGeo = new THREE.BoxGeometry(12, hScale, 12);
                    const towerMat = new THREE.MeshStandardMaterial({
                        color: 0x050510,
                        metalness: 0.9,
                        roughness: 0.05
                    });
                    const tower = new THREE.Mesh(towerGeo, towerMat);
                    tower.position.set(side * (ROAD_WIDTH / 2 + 35), hScale / 2, (Math.random() - 0.5) * SEGMENT_LENGTH);
                    segmentGroup.add(tower);

                    // Add scrolling neon patterns (simulated with layers)
                    const pattern = new THREE.Mesh(
                        new THREE.BoxGeometry(12.2, 2, 12.2),
                        new THREE.MeshBasicMaterial({ color: side === 1 ? 0x00ffff : 0xff00ff, transparent: true, opacity: 0.8 })
                    );
                    pattern.position.y = Math.random() * hScale;
                    pattern.userData.type = 'tower_band';
                    pattern.userData.parentScale = hScale;
                    tower.add(pattern);
                }
            }

            // Neon Arches (Refined)
            if (Math.random() > 0.5) {
                const archGeo = new THREE.TorusGeometry(ROAD_WIDTH / 2 + 2, 0.3, 8, 50, Math.PI);
                const archMat = new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? 0x00ffff : 0xff00ff });
                const arch = new THREE.Mesh(archGeo, archMat);
                arch.rotation.x = 0;
                arch.position.set(0, 0, (Math.random() - 0.5) * SEGMENT_LENGTH);
                segmentGroup.add(arch);
            }

            // Holographic Buildings
            for (let side of [-1, 1]) {
                if (Math.random() > 0.4) {
                    const hScale = 10 + Math.random() * 50;
                    const holoGeo = new THREE.BoxGeometry(10, hScale, 10);
                    const holoMat = new THREE.MeshStandardMaterial({
                        color: side === 1 ? 0x00ffff : 0xff00ff,
                        transparent: true,
                        opacity: 0.2,
                        emissive: side === 1 ? 0x00ffff : 0xff00ff,
                        emissiveIntensity: 0.5
                    });
                    const building = new THREE.Mesh(holoGeo, holoMat);
                    building.position.set(side * (ROAD_WIDTH / 2 + 20), hScale / 2, (Math.random() - 0.5) * SEGMENT_LENGTH);
                    segmentGroup.add(building);

                    // Add Wireframe for definition
                    const wireframe = new THREE.BoxHelper(building, side === 1 ? 0x00ffff : 0xff00ff);
                    segmentGroup.add(wireframe);
                }
            }

            // Floating Geometric Diamonds
            if (Math.random() > 0.5) {
                const diamondGeo = new THREE.OctahedronGeometry(2);
                const diamondMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
                const diamond = new THREE.Mesh(diamondGeo, diamondMat);
                diamond.position.set((Math.random() - 0.5) * 60, 20 + Math.random() * 20, (Math.random() - 0.5) * SEGMENT_LENGTH);
                diamond.userData.type = 'hologram';
                segmentGroup.add(diamond);
            }
            // Futuristic Racing Props
            // Track Barriers (Red/White Striped)
            for (let side of [-1, 1]) {
                const barrier = new THREE.Group();
                const numStripes = 8;
                for (let i = 0; i < numStripes; i++) {
                    const stripe = new THREE.Mesh(
                        new THREE.BoxGeometry(1.5, 3, SEGMENT_LENGTH / numStripes),
                        new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? 0xff0000 : 0xffffff })
                    );
                    stripe.position.set(0, 1.5, (i - numStripes / 2) * (SEGMENT_LENGTH / numStripes) + SEGMENT_LENGTH / (numStripes * 2));
                    barrier.add(stripe);
                }
                barrier.position.set(side * (ROAD_WIDTH / 2 + 3), 0, 0);
                segmentGroup.add(barrier);
            }

            // Futuristic Grandstands (occasional)
            if (Math.random() > 0.6) {
                for (let side of [-1, 1]) {
                    const stand = new THREE.Mesh(
                        new THREE.BoxGeometry(15, 20, SEGMENT_LENGTH),
                        new THREE.MeshStandardMaterial({ color: 0x333344 })
                    );
                    stand.position.set(side * 35, 10, 0);
                    segmentGroup.add(stand);

                    // Holographic Crowd (glowing dots for spectators)
                    for (let j = 0; j < 30; j++) {
                        const crowdMember = new THREE.Mesh(
                            new THREE.SphereGeometry(0.5),
                            new THREE.MeshBasicMaterial({ color: Math.random() * 0xffffff, transparent: true, opacity: 0.7 })
                        );
                        crowdMember.position.set(
                            side * (30 + Math.random() * 10),
                            5 + Math.random() * 15,
                            Math.random() * SEGMENT_LENGTH - SEGMENT_LENGTH / 2
                        );
                        crowdMember.userData.type = 'spectator';
                        crowdMember.userData.offset = Math.random() * Math.PI * 2;
                        segmentGroup.add(crowdMember);
                    }
                }
            }

            // Cybernetic Palm Trees
            if (Math.random() > 0.5) {
                for (let side of [-1, 1]) {
                    const palm = new THREE.Group();
                    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 12), new THREE.MeshStandardMaterial({ color: 0x00aaff }));
                    trunk.position.y = 6;
                    palm.add(trunk);
                    for (let p = 0; p < 5; p++) {
                        const leaf = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 1.5), new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 0.5 }));
                        leaf.position.set(Math.cos(p * 1.25) * 2, 12, Math.sin(p * 1.25) * 2);
                        leaf.rotation.z = 0.4;
                        leaf.rotation.y = p * 1.25;
                        palm.add(leaf);
                    }
                    palm.position.set(side * 22, 0, (Math.random() - 0.5) * SEGMENT_LENGTH);
                    segmentGroup.add(palm);
                }
            }

            // Stadium Flood Lights (futuristic)
            if (Math.random() > 0.7) {
                for (let side of [-1, 1]) {
                    const lightPole = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.5, 0.8, 30),
                        new THREE.MeshStandardMaterial({ color: 0x000033 })
                    );
                    lightPole.position.set(side * 40, 15, Math.random() * SEGMENT_LENGTH - SEGMENT_LENGTH / 2);
                    segmentGroup.add(lightPole);

                    const floodLight = new THREE.Mesh(
                        new THREE.SphereGeometry(2),
                        new THREE.MeshBasicMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 3 })
                    );
                    floodLight.position.set(side * 40, 30, Math.random() * SEGMENT_LENGTH - SEGMENT_LENGTH / 2);
                    segmentGroup.add(floodLight);
                }
            }
        }

        // ITEMS
        if (zPos > 50 && envZone.current !== 'RACING') { // No items in racing mode
            const numItems = Math.floor(Math.random() * 2) + 1;
            for (let k = 0; k < numItems; k++) {
                const laneX = (Math.floor(Math.random() * 3) - 1) * LANE_WIDTH * 1.5;
                const itemZ = Math.random() * SEGMENT_LENGTH - SEGMENT_LENGTH / 2;

                if (Math.random() < 0.3) {
                    const obsGroup = new THREE.Group();
                    const coneGeo = new THREE.ConeGeometry(1, 2.5, 32);
                    const coneMat = new THREE.MeshLambertMaterial({ color: 0xff3300, emissive: 0xff0000, emissiveIntensity: 0.4 });
                    const cone = new THREE.Mesh(coneGeo, coneMat);
                    cone.position.y = 1.25;
                    obsGroup.add(cone);
                    obsGroup.position.set(laneX, 0, itemZ);
                    obsGroup.userData = { type: 'fire' };
                    segmentGroup.add(obsGroup);
                    fires.current.push(obsGroup);
                } else {
                    const isGold = Math.random() > 0.3;
                    const coinGeo = new THREE.OctahedronGeometry(1, 0);
                    const coinMat = new THREE.MeshStandardMaterial({
                        color: isGold ? 0xFFD700 : 0xCCCCCC, metalness: 0.8, roughness: 0.1,
                        emissive: isGold ? 0xaa8800 : 0x444444, emissiveIntensity: 0.4
                    });
                    const coin = new THREE.Mesh(coinGeo, coinMat);
                    coin.position.set(laneX, 1.5, itemZ);
                    coin.userData = { type: 'coin', value: isGold ? 100 : 50, rotSpeed: 0.03 };
                    segmentGroup.add(coin);
                    coins.current.push(coin);
                }
            }
        }
        scene.add(segmentGroup);
        roadSegments.current.push(segmentGroup);
    };

    useEffect(() => {
        if (!sceneRef.current) return;

        const animate = () => {
            if (gameState === 'COUNTDOWN' || gameState === 'PLAYING') {
                if (gameState === 'PLAYING' && !showQuitConfirm) {
                    if (activeKeys.current['brake']) speedRef.current = Math.max(speedRef.current - 0.15, 0);
                    else if (activeKeys.current['front']) speedRef.current = Math.min(speedRef.current + 0.05, CAR_SPEED_MAX);
                    else speedRef.current *= 0.96;

                    const steerSpeed = 0.9;
                    const maxPos = ROAD_WIDTH / 2 - 2;
                    let targetTilt = 0;

                    if (activeKeys.current['left']) {
                        carRef.current.position.x = Math.min(carRef.current.position.x + steerSpeed, maxPos);
                        targetTilt = 0.1;
                    }
                    if (activeKeys.current['right']) {
                        carRef.current.position.x = Math.max(carRef.current.position.x - steerSpeed, -maxPos);
                        targetTilt = -0.1;
                    }
                    carRef.current.rotation.z = THREE.MathUtils.lerp(carRef.current.rotation.z, targetTilt, 0.15);

                    // RACING LOGIC
                    if (envZone.current === 'RACING') {
                        // Track Player Distance
                        const newRaceDist = raceDistance + speedRef.current;
                        setRaceDistance(newRaceDist);
                        setRaceTime(t => t + 1 / 60);

                        // Finish Line Detection (30000 units for strict 3 min)
                        const FINISH_LINE = 30000;
                        if (newRaceDist >= FINISH_LINE) {
                            setGameState('VICTORY');
                        }
                    } else {
                        if (opponentRef.current) opponentRef.current.visible = false;
                    }
                }

                roadSegments.current.forEach((seg) => {
                    seg.position.z -= speedRef.current;
                    if (seg.position.z < -60) {
                        seg.children.forEach(child => {
                            if (child.userData.type === 'coin') coins.current = coins.current.filter(c => c !== child);
                            if (child.userData.type === 'fire') fires.current = fires.current.filter(f => f !== child);
                        });
                        sceneRef.current.remove(seg);
                        roadSegments.current.shift();
                        spawnSegment(roadSegments.current[roadSegments.current.length - 1].position.z + SEGMENT_LENGTH);
                    }
                });

                // RAIN ANIMATION (Moved out of road segment loop)
                if (envZone.current === 'GOTHAM' && rainParticles.current.geometry) {
                    const positions = rainParticles.current.geometry.attributes.position.array;
                    for (let i = 0; i < positions.length; i += 3) {
                        positions[i + 1] -= 2; // Fall speed
                        if (positions[i + 1] < 0) {
                            positions[i + 1] = 100;
                            positions[i + 2] = carRef.current.position.z + (Math.random() - 0.5) * 400;
                        }
                    }
                    rainParticles.current.geometry.attributes.position.needsUpdate = true;
                    rainParticles.current.visible = true;
                } else if (rainParticles.current) {
                    rainParticles.current.visible = false;
                }

                coins.current.forEach(c => { c.rotation.y += c.userData.rotSpeed; c.position.y = 1.5 + Math.sin(Date.now() * 0.005) * 0.3; });
                fires.current.forEach(f => { f.rotation.y += 0.02; });

                // Animate Futuristic Props
                roadSegments.current.forEach(seg => {
                    seg.children.forEach(child => {
                        if (child.userData.type === 'maglev') {
                            child.position.z += child.userData.speed;
                        } else if (child.userData.type === 'ship') {
                            child.position.z += child.userData.speed;
                            child.position.y += Math.sin(Date.now() * 0.002) * 0.1;
                            const blinker = child.children.find(c => c.userData.type === 'blinker');
                            if (blinker) blinker.visible = (Date.now() % 1000) > 500;
                        } else if (child.userData.type === 'hologram') {
                            child.rotation.y += 0.05;
                            child.position.y += Math.sin(Date.now() * 0.005) * 0.1;
                        } else if (child.userData.type === 'spectator') {
                            child.position.y += Math.sin(Date.now() * 0.01 + child.userData.offset) * 0.05;
                            child.scale.setScalar(1 + Math.sin(Date.now() * 0.01 + child.userData.offset) * 0.1);
                        }

                        // Sky Creeper scrolling bands
                        if (child.children) {
                            child.children.forEach(grandchild => {
                                if (grandchild.userData.type === 'tower_band') {
                                    grandchild.position.y += 0.5;
                                    if (grandchild.position.y > grandchild.userData.parentScale / 2) {
                                        grandchild.position.y = -grandchild.userData.parentScale / 2;
                                    }
                                }
                            });
                        }
                    });
                });

                if (gameState === 'PLAYING') {
                    const carPos = carRef.current.position;
                    for (let i = coins.current.length - 1; i >= 0; i--) {
                        const coin = coins.current[i];
                        const coinWorldPos = new THREE.Vector3();
                        coin.getWorldPosition(coinWorldPos);
                        if (carPos.distanceTo(new THREE.Vector3(coinWorldPos.x, carPos.y, coinWorldPos.z)) < 3) {
                            setScore(s => s + coin.userData.value);
                            console.log("Coin collected, playing sound...");
                            playSFX(audioCoinRef);
                            coin.parent.remove(coin);
                            coins.current.splice(i, 1);
                        }
                    }
                    for (let i = fires.current.length - 1; i >= 0; i--) {
                        const fire = fires.current[i];
                        const fireWorldPos = new THREE.Vector3();
                        fire.getWorldPosition(fireWorldPos);
                        if (carPos.distanceTo(new THREE.Vector3(fireWorldPos.x, carPos.y, fireWorldPos.z)) < 2.5) {
                            console.log("Fire hit, playing sound...");
                            playSFX(audioFireRef);
                            setLives(l => {
                                const newLives = l - 1;
                                if (newLives <= 0) setGameState('GAME_OVER');
                                return newLives;
                            });
                            fire.parent.remove(fire);
                            fires.current.splice(i, 1);
                        }
                    }
                    setCurrentSpeed(Math.round(speedRef.current * 100));
                }
            }
            if (composerRef.current) composerRef.current.render();
            animationRef.current = requestAnimationFrame(animate);
        };
        animate();
        return () => cancelAnimationFrame(animationRef.current);
    }, [gameState]);

    useEffect(() => {
        let interval;
        if (gameState === 'COUNTDOWN') interval = setInterval(() => setCountDown(p => p === 1 ? (setGameState('PLAYING'), 0) : p - 1), 1000);
        else if (gameState === 'PLAYING' && !showQuitConfirm) {
            interval = setInterval(() => {
                setTimeLeft(p => {
                    const next = p - 1;
                    if (next <= 0) {
                        setGameState('GAME_OVER');
                        return 0;
                    }

                    // ZONE RADIUS TRANSITION (Disabled in RACING mode)
                    if (envZone.current === 'RACING') return next;

                    if (next > 135) {
                        if (envZone.current !== 'NATURE') envZone.current = 'NATURE';
                    } else if (next > 120) {
                        if (envZone.current !== 'TRANSITION') {
                            envZone.current = 'TRANSITION';
                            setZoneName('APPROACHING CITY');
                            setShowZoneNotify(true);
                            setTimeout(() => setShowZoneNotify(false), 3000);
                        }
                    } else {
                        if (envZone.current !== 'CITY') {
                            envZone.current = 'CITY';
                            setZoneName('NEO-CITY ARCHIVE');
                            setShowZoneNotify(true);
                            setTimeout(() => setShowZoneNotify(false), 3000);
                        }
                    }

                    return next;
                });
            }, 1000);
        } else if (gameState === 'PLAYING') {
            // Backup interval ensure timer keeps reducing
            interval = setInterval(() => setTimeLeft(p => Math.max(0, p - 1)), 1000);
        }
        return () => clearInterval(interval);
    }, [gameState]);

    useEffect(() => {
        if (gameState === 'COUNTDOWN' && countDown === 0) setGameState('PLAYING');
    }, [countDown, gameState]);

    const handleStart = (action) => activeKeys.current[action] = true;
    const handleEnd = (action) => activeKeys.current[action] = false;

    useEffect(() => {
        const kd = (e) => {
            if (e.key.match(/ArrowLeft|a/i)) handleStart('left');
            if (e.key.match(/ArrowRight|d/i)) handleStart('right');
            if (e.key.match(/ArrowUp|w/i)) handleStart('front');
            if (e.key.match(/ArrowDown|s/i)) handleStart('brake');
        };
        const ku = (e) => {
            if (e.key.match(/ArrowLeft|a/i)) handleEnd('left');
            if (e.key.match(/ArrowRight|d/i)) handleEnd('right');
            if (e.key.match(/ArrowUp|w/i)) handleEnd('front');
            if (e.key.match(/ArrowDown|s/i)) handleEnd('brake');
        };
        window.addEventListener('keydown', kd);
        window.addEventListener('keyup', ku);
        return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
    }, []);

    const Btn = ({ icon, action, isBrake }) => (
        <button
            onMouseDown={() => handleStart(action)}
            onMouseUp={() => handleEnd(action)}
            onMouseLeave={() => handleEnd(action)}
            onTouchStart={() => handleStart(action)}
            onTouchEnd={() => handleEnd(action)}
            className={`w-14 h-14 md:w-20 md:h-20 rounded-2xl font-bold text-white text-2xl md:text-3xl shadow-[0_0_15px_rgba(0,255,255,0.5)] active:scale-95 transition-all flex items-center justify-center border-2 border-cyan-400/50 backdrop-blur-md bg-black/60 hover:bg-cyan-500/20 active:bg-cyan-400 active:text-black active:shadow-[0_0_25px_rgba(0,255,255,0.8)] touch-none select-none ${isBrake ? 'bg-red-500/20 border-red-400/50' : ''}`}
        >
            {icon}
        </button>
    );

    return (
        <div className="relative w-screen h-screen bg-slate-800 overflow-hidden font-sans select-none touch-none">
            <canvas ref={canvasRef} className="block w-full h-full" />

            {/* START UI - MOBILE OPTIMIZED */}
            {gameState === 'START' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-xl z-50 px-4">
                    <h1 className="text-5xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-6 drop-shadow-[0_0_15px_rgba(0,255,255,0.5)] italic tracking-tighter text-center leading-none">
                        TWILIGHT <br className="md:hidden" /><span className="text-white">RACER</span>
                    </h1>

                    <div className="bg-black/40 p-6 md:p-10 rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.5)] text-center mb-8 border border-cyan-500/30 backdrop-blur-md relative overflow-hidden group w-full max-w-sm md:max-w-xl">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50"></div>
                        <p className="text-cyan-400 text-lg md:text-2xl font-bold mb-2 tracking-widest font-mono">SYSTEM READY</p>
                        <p className="text-slate-400 font-mono text-xs md:text-sm">Feel the speed of the night</p>
                    </div>

                    {!audioEnabled && (
                        <div className="mb-8 animate-pulse cursor-pointer" onClick={enableAudio}>
                            <span className="bg-red-500/20 border border-red-500 text-red-400 px-4 py-2 md:px-6 md:py-3 rounded-xl font-bold shadow-[0_0_15px_rgba(255,0,0,0.3)] flex items-center gap-2 md:gap-3 backdrop-blur-sm text-sm md:text-base">
                                <FaVolumeMute className="text-lg md:text-2xl" /> TAP TO PLAY SOUND
                            </span>
                        </div>
                    )}

                    <button onClick={() => { enableAudio(); playClick(); setGameState('SELECT_ENV'); }}
                        className="group relative px-10 py-5 md:px-20 md:py-8 bg-cyan-600/20 text-cyan-400 text-xl md:text-4xl font-black rounded-xl border-2 border-cyan-400/50 shadow-[0_0_20px_rgba(0,255,255,0.2)] hover:bg-cyan-400 hover:text-black hover:scale-105 hover:shadow-[0_0_40px_rgba(0,255,255,0.6)] transition-all overflow-hidden w-full max-w-xs md:max-w-none">
                        <span className="relative z-10 flex items-center justify-center gap-3 md:gap-4">
                            <FaPlay /> START ENGINE
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1s_infinite]"></div>
                    </button>
                </div>
            )}

            {/* ENVIRONMENT SELECTION */}
            {gameState === 'SELECT_ENV' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-2xl z-50 px-4">
                    <h2 className="text-4xl md:text-6xl font-black text-white mb-10 drop-shadow-glow italic uppercase tracking-tighter text-center">
                        Choose Your <span className="text-cyan-400">Sector</span>
                    </h2>

                    <div className="flex flex-col md:flex-row gap-4 md:gap-6 w-full max-w-6xl pb-10 md:pb-0 overflow-y-auto max-h-[70vh] md:max-h-none px-2 custom-scrollbar">
                        {/* FOREST CARD */}
                        <div onClick={() => {
                            envZone.current = 'NATURE';
                            setGameState('COUNTDOWN');
                            setLives(3); setScore(0); setTimeLeft(180); setCountDown(3);
                            speedRef.current = 0; activeKeys.current = {};
                            // Reset segments for new environment
                            if (sceneRef.current) {
                                sceneRef.current.background = new THREE.Color(0x4a6fa5);
                                sceneRef.current.fog = new THREE.Fog(0x4a6fa5, 40, 350);
                                roadSegments.current.forEach(s => sceneRef.current.remove(s));
                                roadSegments.current = [];
                                coins.current = [];
                                fires.current = [];
                                for (let i = 0; i < NUM_SEGMENTS; i++) spawnSegment(i * SEGMENT_LENGTH);
                                if (groundRef.current) groundRef.current.material.color.set(0x3b5e3b);
                                if (carRef.current && carRef.current.children[0]) {
                                    carRef.current.children[0].material.color.set(0xffffff);
                                    carRef.current.children[0].material.emissive.set(0x000000);
                                    carRef.current.children[0].material.emissiveIntensity = 0;
                                    const applyDefTex = () => {
                                        if (defaultCarTex.current) {
                                            carRef.current.children[0].material.map = defaultCarTex.current;
                                            carRef.current.children[0].material.needsUpdate = true;
                                        } else {
                                            setTimeout(applyDefTex, 100);
                                        }
                                    };
                                    applyDefTex();
                                }
                            }
                        }}
                            className="flex-shrink-0 md:flex-1 group relative rounded-3xl overflow-hidden border-2 border-green-500/30 hover:border-green-400 transition-all cursor-pointer shadow-2xl bg-gradient-to-b from-green-900/20 to-black/80 min-h-[150px] md:min-h-[400px]">
                            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1441974231531-c6227db76b6e?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80')] bg-cover bg-center grayscale group-hover:grayscale-0 transition-all duration-700 opacity-40 group-hover:opacity-60 scale-110 group-hover:scale-100"></div>
                            <div className="relative h-full p-8 flex flex-col justify-end">
                                <div className="text-green-400 font-mono text-sm mb-2 tracking-[0.3em]">ZONE_01</div>
                                <h3 className="text-3xl md:text-5xl font-black text-white leading-none mb-4">THE GREEN<br />FOREST</h3>
                                <p className="text-slate-300 text-sm md:text-base leading-relaxed max-w-xs group-hover:text-white transition-colors">Start in lush nature and transition to the city as you pick up speed.</p>
                                <div className="mt-6 w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center border border-green-500/50 group-hover:bg-green-500 group-hover:text-black transition-all">
                                    <FaPlay className="ml-1" />
                                </div>
                            </div>
                        </div>

                        {/* RACING CARD */}
                        <div onClick={() => {
                            envZone.current = 'RACING';
                            setGameState('COUNTDOWN');
                            setLives(0); setScore(0); setTimeLeft(180); setCountDown(3);
                            setRaceDistance(0); setRaceTime(0);
                            speedRef.current = 0; activeKeys.current = {};
                            if (sceneRef.current) {
                                sceneRef.current.background = new THREE.Color(0x01010a);
                                sceneRef.current.fog = new THREE.FogExp2(0x01010a, 0.002);
                                roadSegments.current.forEach(s => sceneRef.current.remove(s));
                                roadSegments.current = [];
                                coins.current = [];
                                fires.current = [];
                                for (let i = 0; i < NUM_SEGMENTS; i++) spawnSegment(i * SEGMENT_LENGTH);
                                if (groundRef.current) groundRef.current.material.color.set(0x111111);
                                if (carRef.current && carRef.current.children[0]) {
                                    carRef.current.children[0].material.color.set(0xffffff);
                                    carRef.current.children[0].material.emissive.set(0x000000);
                                    carRef.current.children[0].material.emissiveIntensity = 0;
                                    if (defaultCarTex.current) {
                                        carRef.current.children[0].material.map = defaultCarTex.current;
                                        carRef.current.children[0].material.needsUpdate = true;
                                    }
                                }
                            }
                        }}
                            className="flex-shrink-0 md:flex-1 group relative rounded-3xl overflow-hidden border-2 border-red-500/30 hover:border-red-400 transition-all cursor-pointer shadow-2xl bg-gradient-to-b from-red-900/20 to-black/80 min-h-[150px] md:min-h-[400px]">
                            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1510519138101-570d1dca3d66?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80')] bg-cover bg-center grayscale group-hover:grayscale-0 transition-all duration-700 opacity-40 group-hover:opacity-60 scale-110 group-hover:scale-100"></div>
                            <div className="relative h-full p-8 flex flex-col justify-end">
                                <div className="text-red-400 font-mono text-sm mb-2 tracking-[0.3em]">ZONE_02</div>
                                <h3 className="text-3xl md:text-5xl font-black text-white leading-none mb-4">FORMULA<br />ADRENALINE</h3>
                                <p className="text-slate-300 text-sm md:text-base leading-relaxed max-w-xs group-hover:text-white transition-colors">Compete in the Dubai Stadium against an AI opponent. First to finish wins!</p>
                                <div className="mt-6 w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center border border-red-500/50 group-hover:bg-red-500 group-hover:text-black transition-all">
                                    <FaPlay className="ml-1" />
                                </div>
                            </div>
                        </div>

                        {/* CITY CARD */}
                        <div onClick={() => {
                            envZone.current = 'CITY';
                            setGameState('COUNTDOWN');
                            setLives(3); setScore(0); setTimeLeft(180); setCountDown(3);
                            speedRef.current = 0; activeKeys.current = {};
                            // Reset segments for new environment
                            if (sceneRef.current) {
                                sceneRef.current.background = new THREE.Color(0x020205);
                                sceneRef.current.fog = new THREE.FogExp2(0x020205, 0.002);
                                roadSegments.current.forEach(s => sceneRef.current.remove(s));
                                roadSegments.current = [];
                                coins.current = [];
                                fires.current = [];
                                for (let i = 0; i < NUM_SEGMENTS; i++) spawnSegment(i * SEGMENT_LENGTH);
                                if (groundRef.current) groundRef.current.material.color.set(0x050505);
                                if (carRef.current && carRef.current.children[0]) {
                                    carRef.current.children[0].material.color.set(0xffffff);
                                    carRef.current.children[0].material.emissive.set(0x000000);
                                    carRef.current.children[0].material.emissiveIntensity = 0;
                                    if (defaultCarTex.current) {
                                        carRef.current.children[0].material.map = defaultCarTex.current;
                                        carRef.current.children[0].material.needsUpdate = true;
                                    }
                                }
                            }
                        }}
                            className="flex-shrink-0 md:flex-1 group relative rounded-3xl overflow-hidden border-2 border-cyan-500/30 hover:border-cyan-400 transition-all cursor-pointer shadow-2xl bg-gradient-to-b from-blue-900/20 to-black/80 min-h-[150px] md:min-h-[400px]">
                            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1546410531-bb4caa6b424d?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80')] bg-cover bg-center grayscale group-hover:grayscale-0 transition-all duration-700 opacity-40 group-hover:opacity-60 scale-110 group-hover:scale-100"></div>
                            <div className="relative h-full p-8 flex flex-col justify-end">
                                <div className="text-cyan-400 font-mono text-sm mb-2 tracking-[0.3em]">ZONE_03</div>
                                <h3 className="text-3xl md:text-5xl font-black text-white leading-none mb-4">NEO-CITY<br />ARCHIVE</h3>
                                <p className="text-slate-300 text-sm md:text-base leading-relaxed max-w-xs group-hover:text-white transition-colors">Jump directly into the neon metropolis for a high-intensity urban chase.</p>
                                <div className="mt-6 w-12 h-12 bg-cyan-500/20 rounded-full flex items-center justify-center border border-cyan-500/50 group-hover:bg-cyan-500 group-hover:text-black transition-all">
                                    <FaPlay className="ml-1" />
                                </div>
                            </div>
                        </div>

                        {/* GOTHAM CARD */}
                        <div onClick={() => {
                            envZone.current = 'GOTHAM';
                            setGameState('COUNTDOWN');
                            setLives(3); setScore(0); setTimeLeft(180); setCountDown(3);
                            speedRef.current = 0; activeKeys.current = {};
                            if (sceneRef.current) {
                                sceneRef.current.background = new THREE.Color(0x020205);
                                sceneRef.current.fog = new THREE.FogExp2(0x020205, 0.003);
                                roadSegments.current.forEach(s => sceneRef.current.remove(s));
                                roadSegments.current = [];
                                coins.current = [];
                                fires.current = [];
                                for (let i = 0; i < NUM_SEGMENTS; i++) spawnSegment(i * SEGMENT_LENGTH);
                                if (groundRef.current) groundRef.current.material.color.set(0x050505);
                                if (carRef.current && carRef.current.children[0]) {
                                    carRef.current.children[0].material.color.set(0xffffff);
                                    carRef.current.children[0].material.emissive.set(0x333333);
                                    carRef.current.children[0].material.emissiveIntensity = 0.2;
                                    const applyBatTex = () => {
                                        if (batmobileTex.current) {
                                            carRef.current.children[0].material.map = batmobileTex.current;
                                            carRef.current.children[0].material.needsUpdate = true;
                                        } else {
                                            setTimeout(applyBatTex, 100);
                                        }
                                    };
                                    applyBatTex();
                                }
                            }
                        }}
                            className="flex-shrink-0 md:flex-1 group relative rounded-3xl overflow-hidden border-2 border-indigo-500/30 hover:border-indigo-400 transition-all cursor-pointer shadow-2xl bg-gradient-to-b from-indigo-900/20 to-black/80 min-h-[150px] md:min-h-[400px]">
                            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1514565131-fce0801e5785?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80')] bg-cover bg-center grayscale group-hover:grayscale-0 transition-all duration-700 opacity-40 group-hover:opacity-60 scale-110 group-hover:scale-100"></div>
                            <div className="relative h-full p-8 flex flex-col justify-end">
                                <div className="text-indigo-400 font-mono text-sm mb-2 tracking-[0.3em]">ZONE_04</div>
                                <h3 className="text-3xl md:text-5xl font-black text-white leading-none mb-4">GOTHAM<br />NIGHTS</h3>
                                <p className="text-slate-300 text-sm md:text-base leading-relaxed max-w-xs group-hover:text-white transition-colors">Experience the dark, gothic architecture of a high-density industrial metropolis.</p>
                                <div className="flex gap-4 mt-6">
                                    <div className="w-12 h-12 bg-indigo-500/20 rounded-full flex items-center justify-center border border-indigo-500/50 group-hover:bg-indigo-500 group-hover:text-black transition-all">
                                        <FaPlay className="ml-1" />
                                    </div>
                                    <button onClick={(e) => {
                                        e.stopPropagation();
                                        window.open('/city_architect_demo.html', '_blank');
                                    }} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-lg border border-white/20 transition-all uppercase tracking-widest">
                                        View Architect
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <button onClick={() => { playClick(); setGameState('START'); }} className="mt-8 text-slate-500 hover:text-white transition-colors font-mono text-xs tracking-widest uppercase">
                        &lt; Return to Main System
                    </button>
                </div>
            )}

            {/* COUNTDOWN */}
            {gameState === 'COUNTDOWN' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50 bg-black/20 backdrop-blur-sm">
                    <div className="text-[10rem] md:text-[15rem] font-black text-cyan-400 drop-shadow-[0_0_50px_rgba(0,255,255,0.8)] font-mono animate-bounce">
                        {countDown > 0 ? countDown : "GO!"}
                    </div>
                </div>
            )}

            {/* HUD - SCALED FOR MOBILE */}
            {gameState !== 'START' && gameState !== 'SELECT_ENV' && (
                <>
                    <div className="absolute top-0 left-0 w-full p-4 md:p-6 flex justify-between items-start pointer-events-none z-40">
                        <div className="flex flex-col gap-2 md:gap-3 scale-90 origin-top-left md:scale-100">
                            <div className="bg-black/60 px-4 py-2 md:px-8 md:py-4 rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.5)] flex gap-2 md:gap-4 items-center border-l-4 border-cyan-400 backdrop-blur-md">
                                <span className="text-2xl md:text-4xl text-yellow-400 drop-shadow-md"><GiTrophyCup /></span>
                                <span className="text-3xl md:text-5xl font-black text-white font-mono tracking-wider">{score.toString().padStart(4, '0')}</span>
                            </div>

                            {envZone.current === 'RACING' && (
                                <div className="bg-black/60 px-4 py-2 md:px-8 md:py-3 rounded-xl border-l-4 border-red-500 backdrop-blur-md flex flex-col">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-red-400 font-bold text-xs md:text-sm uppercase tracking-tighter">Race Distance</span>
                                        <span className="text-white font-mono text-sm md:text-lg">{(30000 - raceDistance).toFixed(0)}m</span>
                                    </div>
                                    <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                                        <div className="bg-red-500 h-full transition-all duration-300" style={{ width: `${(raceDistance / 30000) * 100}%` }}></div>
                                    </div>
                                    <div className="mt-1 text-[10px] md:text-xs text-slate-400 font-mono uppercase">
                                        Race Progress
                                    </div>
                                </div>
                            )}
                            <div className="flex gap-1 md:gap-2 pl-1 md:pl-2">
                                {[...Array(3)].map((_, i) => (
                                    <span key={i} className={`text-2xl md:text-4xl transition-all drop-shadow-lg ${i < lives ? 'text-red-500 scale-100' : 'text-gray-600 scale-90 opacity-50'}`}>
                                        <div className="bg-white rounded-full p-1"><FaArrowUp className="rotate-0 text-transparent" />❤️</div>
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 origin-top-right scale-90 md:scale-100">
                            <div className={`bg-black/60 text-white px-4 py-2 md:px-8 md:py-3 rounded-xl text-3xl md:text-5xl font-black font-mono shadow-[0_0_15px_rgba(0,0,0,0.5)] border-r-4 ${timeLeft < 30 ? 'border-red-500 text-red-400 animate-pulse' : 'border-cyan-400'} backdrop-blur-md flex items-center gap-4`}>
                                {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                                <button
                                    onClick={() => setShowQuitConfirm(true)}
                                    className="ml-2 p-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm md:text-lg hover:bg-red-500 hover:text-white transition-all pointer-events-auto shadow-lg"
                                >
                                    QUIT
                                </button>
                            </div>

                            {/* SPEEDOMETER */}
                            <div className="bg-black/40 border border-white/10 px-4 py-2 rounded-xl backdrop-blur-sm shadow-xl flex items-baseline gap-2">
                                <span className="text-white/40 font-mono text-[10px] uppercase tracking-widest">Velocity</span>
                                <span className={`text-2xl md:text-4xl font-black font-mono tracking-tighter ${currentSpeed > 100 ? 'text-red-500' : currentSpeed > 60 ? 'text-yellow-400' : 'text-cyan-400'} drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]`}>
                                    {currentSpeed.toString().padStart(3, '0')}
                                </span>
                                <span className="text-white/60 font-mono text-[10px]">KM/H</span>
                            </div>
                        </div>
                    </div>

                    {gameState === 'PLAYING' && (
                        <div className="absolute bottom-20 left-0 w-full px-6 flex justify-between items-end pb-safe z-50 md:bottom-10 md:px-10">
                            <div className="flex gap-4">
                                <Btn icon={<FaArrowLeft />} action="left" />
                                <Btn icon={<FaArrowRight />} action="right" />
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <div className="text-white/50 font-mono text-[10px] uppercase tracking-widest bg-black/40 px-3 py-1 rounded-full border border-white/10 mb-1">Pedals</div>
                                <div className="flex gap-4">
                                    <Btn icon={<div className="flex flex-col items-center"><div className="w-2 h-2 bg-white mb-1"></div>S</div>} action="brake" isBrake />
                                    <Btn icon={<FaArrowUp />} action="front" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* QUIT CONFIRMATION DIALOG */}
                    {showQuitConfirm && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-xl z-[100] px-4">
                            <div className="bg-slate-900 border-2 border-red-500/50 p-8 md:p-12 rounded-[2rem] shadow-[0_0_50px_rgba(239,68,68,0.3)] max-w-md w-full text-center animate-in zoom-in duration-300">
                                <div className="w-20 h-20 bg-red-500/10 border-2 border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <FaArrowDown className="text-red-500 text-4xl rotate-180" />
                                </div>
                                <h3 className="text-3xl md:text-4xl font-black text-white mb-4 italic uppercase tracking-tighter">Exit Mission?</h3>
                                <p className="text-slate-400 mb-8 font-mono text-sm leading-relaxed">Your progress in this sector will be lost. System will reboot to Zone Selection.</p>

                                <div className="flex flex-col gap-4">
                                    <button
                                        onClick={() => setShowQuitConfirm(false)}
                                        className="w-full py-4 bg-white text-black font-black text-xl rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl"
                                    >
                                        STAY & RACE
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowQuitConfirm(false);
                                            setGameState('SELECT_ENV');
                                        }}
                                        className="w-full py-4 bg-red-500/10 border-2 border-red-500/50 text-red-500 font-black text-xl rounded-2xl hover:bg-red-500 hover:text-white transition-all"
                                    >
                                        QUIT TO ZONE
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ZONE NOTIFICATION */}
                    {showZoneNotify && (
                        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50 text-center animate-pulse">
                            <div className="text-cyan-400 text-sm md:text-xl font-mono tracking-[0.5em] mb-2">ZONE DETECTED</div>
                            <div className="text-white text-3xl md:text-6xl font-black italic border-y border-white/20 py-4 px-10 backdrop-blur-sm bg-cyan-500/10">
                                {zoneName}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* GAME OVER / DEFEAT */}
            {gameState === 'GAME_OVER' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur-xl z-50 px-4 text-center">
                    <h1 className="text-5xl md:text-9xl font-black mb-6 md:mb-8 text-red-500 drop-shadow-[0_0_30px_rgba(255,0,0,0.5)] italic uppercase tracking-tighter">
                        {envZone.current === 'RACING' ? "DEFEATED" : "SYSTEM FAILURE"}
                    </h1>
                    <div className="bg-black/50 p-8 md:p-12 rounded-3xl border border-red-500/20 backdrop-blur-md mb-8 md:mb-10 shadow-2xl w-full max-w-xs md:max-w-xl text-center">
                        {envZone.current === 'RACING' ? (
                            <>
                                <div className="text-xl md:text-2xl text-red-200 font-mono mb-2 md:mb-4">OPPONENT FINISHED FIRST</div>
                                <div className="text-slate-400 font-mono text-xs md:text-sm">Better luck next time, racer.</div>
                            </>
                        ) : (
                            <>
                                <div className="text-xl md:text-2xl text-red-200 font-mono mb-2 md:mb-4">FINAL SCORE</div>
                                <div className="text-6xl md:text-8xl text-white font-black font-mono tracking-widest drop-shadow-[0_0_20px_rgba(0,255,255,0.5)]">
                                    {score.toString().padStart(5, '0')}
                                </div>
                            </>
                        )}
                    </div>
                    <button onClick={() => setGameState('START')} className="px-10 py-4 md:px-16 md:py-6 bg-red-500/20 border-2 border-red-500 text-white text-xl md:text-3xl font-black rounded-full hover:bg-red-500 transition-all shadow-[0_0_30px_rgba(255,0,0,0.3)] flex items-center gap-3 md:gap-4">
                        <FaRedo /> TRY AGAIN
                    </button>
                </div>
            )}

            {/* VICTORY */}
            {gameState === 'VICTORY' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur-xl z-50 px-4 text-center">
                    <div className="text-yellow-400 text-6xl md:text-9xl mb-4 animate-bounce drop-shadow-[0_0_50px_rgba(255,255,0,0.6)]">🏆</div>
                    <h1 className="text-5xl md:text-9xl font-black mb-6 md:mb-8 text-cyan-400 drop-shadow-[0_0_30px_rgba(0,255,255,0.5)] italic uppercase tracking-tighter">
                        VICTORY!
                    </h1>
                    <div className="bg-black/50 p-8 md:p-12 rounded-3xl border border-cyan-500/20 backdrop-blur-md mb-8 md:mb-10 shadow-2xl w-full max-w-xs md:max-w-xl text-center">
                        <div className="text-xl md:text-2xl text-cyan-200 font-mono mb-2 md:mb-4">RACE TIME</div>
                        <div className="text-5xl md:text-7xl text-white font-black font-mono tracking-tighter drop-shadow-[0_0_20px_rgba(0,255,255,0.5)]">
                            {Math.floor(raceTime / 60)}:{String(Math.floor(raceTime % 60)).padStart(2, '0')}.{String(Math.floor((raceTime * 100) % 100)).padStart(2, '0')}
                        </div>
                        <div className="mt-4 text-cyan-500/60 font-mono text-xs uppercase tracking-widest">Podium Secured</div>
                    </div>
                    <button onClick={() => setGameState('START')} className="px-10 py-4 md:px-16 md:py-6 bg-cyan-600 border-2 border-cyan-400 text-white text-xl md:text-3xl font-black rounded-full hover:scale-110 transition-transform shadow-[0_0_40px_rgba(0,255,255,0.5)] flex items-center gap-3 md:gap-4">
                        <FaRedo /> RETURN TO TERMINAL
                    </button>
                </div>
            )}
        </div>
    );
};

export default CarGame;
