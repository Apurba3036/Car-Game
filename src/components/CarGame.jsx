import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import carImg from '../assets/image.png';
import { FaArrowLeft, FaArrowRight, FaArrowUp, FaArrowDown, FaPlay, FaRedo, FaVolumeMute, FaVolumeUp } from 'react-icons/fa'; // React Icons
import { GiTrophyCup } from 'react-icons/gi'; // Game Icon

// AUDIO IMPORTS
import musicMenu from '../assets/mfcc-speed-speed-racing-cycling-music-257904.mp3';
import musicRace1 from '../assets/lnplusmusic-racing-speed-driving-music-416549.mp3';
import musicRace2 from '../assets/mfcc-speed-speed-racing-cycling-music-257904.mp3';
import sfxCoin from '../assets/point collection.mp3';
import sfxFire from '../assets/fire collection.mp3';

const CarGame = () => {
    const canvasRef = useRef(null);
    const [gameState, setGameState] = useState('START');
    const [score, setScore] = useState(0);
    const [lives, setLives] = useState(3);
    const [timeLeft, setTimeLeft] = useState(180);
    const [countDown, setCountDown] = useState(3);

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

    // Audio Refs
    const audioMenuRef = useRef(new Audio(musicMenu));
    const audioRace1Ref = useRef(new Audio(musicRace1));
    const audioRace2Ref = useRef(new Audio(musicRace2));
    const audioCoinRef = useRef(new Audio(sfxCoin));
    const audioFireRef = useRef(new Audio(sfxFire));
    const currentRaceTrack = useRef(1); // 1 or 2

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

        // Configure Loops/Events
        menuAudio.loop = true;

        race1.onended = () => { race1.currentTime = 0; race2.play(); currentRaceTrack.current = 2; };
        race2.onended = () => { race2.currentTime = 0; race1.play(); currentRaceTrack.current = 1; };

        // Preload SFX
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
            // Try to play, if blocked, we wait for user interaction
            const playPromise = menuAudio.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    setAudioEnabled(true);
                }).catch(error => {
                    console.log("Autoplay prevented. User interaction needed.");
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

        return () => {
            // Cleanup on unmount only? 
        };
    }, [gameState]);

    // GLOBAL UNMUTE HANDLER
    const enableAudio = () => {
        if (!audioEnabled && gameState === 'START') {
            audioMenuRef.current.play();
            setAudioEnabled(true);
        }
    };

    useEffect(() => {
        window.addEventListener('click', enableAudio);
        return () => window.removeEventListener('click', enableAudio);
    }, [gameState, audioEnabled]);

    useEffect(() => {
        if (!canvasRef.current || sceneRef.current) return;

        // 1. SCENE SETUP - EVENING
        const scene = new THREE.Scene();
        const skyColor = 0x4a6fa5;
        scene.background = new THREE.Color(skyColor);
        scene.fog = new THREE.Fog(skyColor, 40, 250);

        // 2. CAMERA
        const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 6, -15);
        camera.lookAt(0, 0, 25);

        // 3. RENDERER
        const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: false });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;

        // 4. POST-PROCESSING
        const renderScene = new RenderPass(scene, camera);
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
        bloomPass.threshold = 0.6;
        bloomPass.strength = 0.4;
        bloomPass.radius = 0.3;

        const composer = new EffectComposer(renderer);
        composer.addPass(renderScene);
        composer.addPass(bloomPass);
        composerRef.current = composer;

        // 5. LIGHTING
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffebd7, 1.2);
        dirLight.position.set(50, 80, -30);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 4096;
        dirLight.shadow.mapSize.height = 4096;
        scene.add(dirLight);

        // 6. GROUND
        const groundGeo = new THREE.PlaneGeometry(2000, 2000);
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x3b5e3b,
            roughness: 1, metalness: 0
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.1;
        ground.receiveShadow = true;
        scene.add(ground);

        // 7. PLAYER CAR - IMAGE SPRITE WITH BACKGROUND REMOVAL
        const carGroup = new THREE.Group();

        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(carImg, (tex) => {
            const img = tex.image;
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i]; const g = data[i + 1]; const b = data[i + 2];
                if (r > 200 && g > 200 && b > 200) data[i + 3] = 0;
            }
            ctx.putImageData(imgData, 0, 0);
            const processedTexture = new THREE.CanvasTexture(canvas);
            processedTexture.encoding = THREE.sRGBEncoding;
            processedTexture.minFilter = THREE.LinearFilter;
            processedTexture.magFilter = THREE.LinearFilter;
            const spriteMat = new THREE.MeshStandardMaterial({
                map: processedTexture, transparent: true, alphaTest: 0.1,
                roughness: 0.4, metalness: 0.2, side: THREE.DoubleSide
            });
            const spriteGeo = new THREE.PlaneGeometry(5, 3);
            const carMesh = new THREE.Mesh(spriteGeo, spriteMat);
            carMesh.position.y = 1.5; carMesh.rotation.y = Math.PI;
            carMesh.castShadow = true; carMesh.receiveShadow = true;
            carGroup.add(carMesh);
        });

        // Shadow blob
        const shadowGeo = new THREE.PlaneGeometry(4, 2);
        const shadowMat = new THREE.MeshBasicMaterial({
            color: 0x000000, transparent: true, opacity: 0.6
        });
        const shadow = new THREE.Mesh(shadowGeo, shadowMat);
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = 0.05;
        carGroup.add(shadow);

        scene.add(carGroup);
        carRef.current = carGroup;

        sceneRef.current = scene;
        cameraRef.current = camera;
        rendererRef.current = renderer;

        const handleResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            composer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener('resize', handleResize);

        // Initial Road
        for (let i = 0; i < NUM_SEGMENTS; i++) {
            spawnSegment(i * SEGMENT_LENGTH);
        }

        // 8. BACKGROUND CITY
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
            if (Math.random() < 0.3) {
                const win = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.6, h * 0.8), windowMat);
                win.position.z = d / 2 + 0.1;
                b.add(win);
            }
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

        // Road
        const road = new THREE.Mesh(
            new THREE.PlaneGeometry(ROAD_WIDTH, SEGMENT_LENGTH),
            new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 })
        );
        road.rotation.x = -Math.PI / 2;
        road.receiveShadow = true;
        segmentGroup.add(road);

        // Lane Lines
        const lineGeo = new THREE.PlaneGeometry(0.8, 6);
        const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        for (let i = 0; i < SEGMENT_LENGTH; i += 15) {
            const line = new THREE.Mesh(lineGeo, lineMat);
            line.rotation.x = -Math.PI / 2;
            line.position.set(0, 0.05, i - SEGMENT_LENGTH / 2);
            segmentGroup.add(line);
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

        // Trees
        for (let i = 0; i < 2; i++) {
            const tree = new THREE.Group();
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 2), new THREE.MeshStandardMaterial({ color: 0x5C4033 }));
            trunk.position.y = 1;
            tree.add(trunk);
            const leaves = new THREE.Mesh(new THREE.DodecahedronGeometry(2), new THREE.MeshStandardMaterial({ color: 0x228B22, flatShading: true }));
            leaves.position.y = 3;
            tree.add(leaves);
            const side = Math.random() > 0.5 ? 1 : -1;
            tree.position.set(side * (20 + Math.random() * 10), 0, Math.random() * SEGMENT_LENGTH - SEGMENT_LENGTH / 2);
            segmentGroup.add(tree);
        }

        // ITEMS
        if (zPos > 50) {
            const numItems = Math.floor(Math.random() * 2) + 1;
            for (let k = 0; k < numItems; k++) {
                const laneX = (Math.floor(Math.random() * 3) - 1) * LANE_WIDTH * 1.5;
                const itemZ = Math.random() * SEGMENT_LENGTH - SEGMENT_LENGTH / 2;

                if (Math.random() < 0.3) {
                    // Fire -> Beacon
                    const obsGroup = new THREE.Group();
                    const coneGeo = new THREE.ConeGeometry(1, 2.5, 32);
                    const coneMat = new THREE.MeshLambertMaterial({
                        color: 0xff3300,
                        emissive: 0xff0000,
                        emissiveIntensity: 0.4
                    });
                    const cone = new THREE.Mesh(coneGeo, coneMat);
                    cone.position.y = 1.25;
                    obsGroup.add(cone);
                    obsGroup.position.set(laneX, 0, itemZ);
                    obsGroup.userData = { type: 'fire' };
                    segmentGroup.add(obsGroup);
                    fires.current.push(obsGroup);
                } else {
                    // Coin -> Gold
                    const isGold = Math.random() > 0.3;
                    const coinGeo = new THREE.OctahedronGeometry(1, 0);
                    const coinMat = new THREE.MeshStandardMaterial({
                        color: isGold ? 0xFFD700 : 0xCCCCCC,
                        metalness: 0.8,
                        roughness: 0.1,
                        emissive: isGold ? 0xaa8800 : 0x444444,
                        emissiveIntensity: 0.4
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

    // GAME LOOP
    useEffect(() => {
        if (!sceneRef.current) return;

        const animate = () => {
            if (gameState === 'COUNTDOWN' || gameState === 'PLAYING') {
                if (gameState === 'PLAYING') {
                    if (activeKeys.current['front']) speedRef.current = Math.min(speedRef.current + 0.05, CAR_SPEED_MAX);
                    else if (activeKeys.current['back']) speedRef.current = Math.max(speedRef.current - 0.1, 0);
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

                coins.current.forEach(c => { c.rotation.y += c.userData.rotSpeed; c.position.y = 1.5 + Math.sin(Date.now() * 0.005) * 0.3; });
                fires.current.forEach(f => { f.rotation.y += 0.02; });

                if (gameState === 'PLAYING') {
                    const carPos = carRef.current.position;
                    // CHECK COIN COLLISIONS
                    for (let i = coins.current.length - 1; i >= 0; i--) {
                        const coin = coins.current[i];
                        const coinWorldPos = new THREE.Vector3();
                        coin.getWorldPosition(coinWorldPos);
                        if (carPos.distanceTo(new THREE.Vector3(coinWorldPos.x, carPos.y, coinWorldPos.z)) < 3) {
                            setScore(s => s + coin.userData.value);
                            if (audioCoinRef.current) { audioCoinRef.current.currentTime = 0; audioCoinRef.current.play().catch(e => { }); }
                            coin.parent.remove(coin);
                            coins.current.splice(i, 1);
                        }
                    }
                    // CHECK FIRE COLLISIONS
                    for (let i = fires.current.length - 1; i >= 0; i--) {
                        const fire = fires.current[i];
                        const fireWorldPos = new THREE.Vector3();
                        fire.getWorldPosition(fireWorldPos);
                        if (carPos.distanceTo(new THREE.Vector3(fireWorldPos.x, carPos.y, fireWorldPos.z)) < 2.5) {
                            if (audioFireRef.current) { audioFireRef.current.currentTime = 0; audioFireRef.current.play().catch(e => { }); }
                            setLives(l => {
                                const newLives = l - 1;
                                if (newLives <= 0) setGameState('GAME_OVER');
                                return newLives;
                            });
                            fire.parent.remove(fire);
                            fires.current.splice(i, 1);
                        }
                    }
                }
            }
            composerRef.current.render();
            animationRef.current = requestAnimationFrame(animate);
        };
        animate();
        return () => cancelAnimationFrame(animationRef.current);
    }, [gameState]);

    // TIMER LOGIC
    useEffect(() => {
        let interval;
        if (gameState === 'COUNTDOWN') {
            interval = setInterval(() => {
                setCountDown(prev => {
                    if (prev <= 1) return 0; // Will trigger effect below
                    return prev - 1;
                });
            }, 1000);
        } else if (gameState === 'PLAYING') {
            interval = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        setGameState('GAME_OVER');
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [gameState]);

    // COUNTDOWN TRANSITION
    useEffect(() => {
        if (gameState === 'COUNTDOWN' && countDown === 0) {
            setGameState('PLAYING');
        }
    }, [countDown, gameState]);

    const handleStart = (action) => activeKeys.current[action] = true;
    const handleEnd = (action) => activeKeys.current[action] = false;

    useEffect(() => {
        const kd = (e) => {
            if (e.key.match(/ArrowLeft|a/i)) handleStart('left');
            if (e.key.match(/ArrowRight|d/i)) handleStart('right');
            if (e.key.match(/ArrowUp|w/i)) handleStart('front');
            if (e.key.match(/ArrowDown|s/i)) handleStart('back');
        };
        const ku = (e) => {
            if (e.key.match(/ArrowLeft|a/i)) handleEnd('left');
            if (e.key.match(/ArrowRight|d/i)) handleEnd('right');
            if (e.key.match(/ArrowUp|w/i)) handleEnd('front');
            if (e.key.match(/ArrowDown|s/i)) handleEnd('back');
        };
        window.addEventListener('keydown', kd);
        window.addEventListener('keyup', ku);
        return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
    }, []);

    const Btn = ({ icon, action, color }) => (
        <button
            onMouseDown={() => handleStart(action)}
            onMouseUp={() => handleEnd(action)}
            onMouseLeave={() => handleEnd(action)}
            onTouchStart={(e) => { e.preventDefault(); handleStart(action); }}
            onTouchEnd={(e) => { e.preventDefault(); handleEnd(action); }}
            className={`w-20 h-20 rounded-2xl font-bold text-white text-3xl shadow-[0_0_15px_rgba(0,255,255,0.5)] active:scale-95 transition-all flex items-center justify-center border-2 border-cyan-400/50 backdrop-blur-md bg-black/60 hover:bg-cyan-500/20 active:bg-cyan-400 active:text-black active:shadow-[0_0_25px_rgba(0,255,255,0.8)]`}
        >
            {icon}
        </button>
    );

    return (
        <div className="relative w-screen h-screen bg-slate-800 overflow-hidden font-sans select-none">
            <canvas ref={canvasRef} className="block w-full h-full" />

            {/* START UI */}
            {gameState === 'START' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-xl z-50">
                    <h1 className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-6 drop-shadow-[0_0_15px_rgba(0,255,255,0.5)] italic tracking-tighter">
                        TWILIGHT <span className="text-white">RACER</span>
                    </h1>

                    {/* DIGITAL PANEL */}
                    <div className="bg-black/40 p-10 rounded-3xl shadow-[0_0_30px_rgba(0,0,0,0.5)] text-center mb-10 border border-cyan-500/30 backdrop-blur-md relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50"></div>
                        <p className="text-cyan-400 text-2xl font-bold mb-2 tracking-widest font-mono">SYSTEM READY</p>
                        <p className="text-slate-400 font-mono text-sm">Feel the speed of the night</p>
                    </div>

                    {/* AUDIO STATUS INDICATOR */}
                    {!audioEnabled && (
                        <div className="mb-8 animate-pulse cursor-pointer" onClick={enableAudio}>
                            <span className="bg-red-500/20 border border-red-500 text-red-400 px-6 py-3 rounded-xl font-bold shadow-[0_0_15px_rgba(255,0,0,0.3)] flex items-center gap-3 backdrop-blur-sm">
                                <FaVolumeMute className="text-2xl" /> TAP TO INITIALIZE AUDIO
                            </span>
                        </div>
                    )}

                    {/* START BUTTON */}
                    <button onClick={() => {
                        setGameState('COUNTDOWN');
                        setLives(3);
                        setScore(0);
                        setTimeLeft(180);
                        setCountDown(3);
                        speedRef.current = 0;
                        activeKeys.current = {};
                    }}
                        className="group relative px-20 py-8 bg-cyan-600/20 text-cyan-400 text-4xl font-black rounded-xl border-2 border-cyan-400/50 shadow-[0_0_20px_rgba(0,255,255,0.2)] hover:bg-cyan-400 hover:text-black hover:scale-105 hover:shadow-[0_0_40px_rgba(0,255,255,0.6)] transition-all overflow-hidden">
                        <span className="relative z-10 flex items-center gap-4">
                            <FaPlay /> START ENGINE
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1s_infinite]"></div>
                    </button>
                </div>
            )}

            {/* COUNTDOWN */}
            {gameState === 'COUNTDOWN' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50 bg-black/20 backdrop-blur-sm">
                    {/* Changed animate-ping to animate-bounce to avoid ghosting issues */}
                    <div className="text-[15rem] font-black text-cyan-400 drop-shadow-[0_0_50px_rgba(0,255,255,0.8)] font-mono animate-bounce">
                        {countDown > 0 ? countDown : "GO!"}
                    </div>
                </div>
            )}

            {/* HUD */}
            {gameState !== 'START' && (
                <>
                    <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start pointer-events-none">
                        <div className="flex flex-col gap-3">
                            {/* SCORE */}
                            <div className="bg-black/60 px-8 py-4 rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.5)] flex gap-4 items-center border-l-4 border-cyan-400 backdrop-blur-md">
                                <span className="text-4xl text-yellow-400 drop-shadow-md"><GiTrophyCup /></span>
                                <span className="text-5xl font-black text-white font-mono tracking-wider">{score.toString().padStart(4, '0')}</span>
                            </div>
                            {/* LIVES */}
                            <div className="flex gap-2 pl-2">
                                {[...Array(3)].map((_, i) => (
                                    <span key={i} className={`text-4xl transition-all drop-shadow-lg ${i < lives ? 'text-red-500 scale-100' : 'text-gray-600 scale-90 opacity-50'}`}>
                                        <div className="bg-white rounded-full p-1"><FaArrowUp className="rotate-0 text-transparent" />❤️</div>
                                    </span>
                                ))}
                            </div>
                        </div>
                        {/* TIMER */}
                        <div className={`bg-black/60 text-white px-8 py-3 rounded-xl text-5xl font-black font-mono shadow-[0_0_15px_rgba(0,0,0,0.5)] border-r-4 ${timeLeft < 30 ? 'border-red-500 text-red-400 animate-pulse' : 'border-cyan-400'} backdrop-blur-md`}>
                            {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                        </div>
                    </div>

                    {gameState === 'PLAYING' && (
                        <div className="absolute bottom-8 left-0 w-full px-10 flex justify-between items-end pb-safe">
                            <div className="flex gap-4">
                                <Btn icon={<FaArrowLeft />} action="left" />
                                <Btn icon={<FaArrowRight />} action="right" />
                            </div>
                            <div className="flex gap-4">
                                <Btn icon={<FaArrowDown />} action="back" />
                                <Btn icon={<FaArrowUp />} action="front" />
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* GAME OVER */}
            {gameState === 'GAME_OVER' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur-xl z-50">
                    <h1 className={`text-9xl font-black mb-8 drop-shadow-[0_0_30px_rgba(0,0,0,0.5)] italic ${lives > 0 ? 'text-green-400' : 'text-red-500'}`}>
                        {lives > 0 ? "MISSION ACCOMPLISHED" : "SYSTEM FAILURE"}
                    </h1>
                    <div className="bg-black/50 p-12 rounded-3xl border border-white/10 backdrop-blur-md text-center mb-10 shadow-2xl">
                        <div className="text-2xl text-cyan-200 font-mono mb-4">FINAL SCORE</div>
                        <div className="text-8xl text-white font-black font-mono tracking-widest drop-shadow-[0_0_20px_rgba(0,255,255,0.5)]">
                            {score.toString().padStart(5, '0')}
                        </div>
                    </div>
                    <button onClick={() => setGameState('START')} className="px-16 py-6 bg-white text-black text-3xl font-black rounded-full hover:scale-110 transition-transform shadow-[0_0_30px_rgba(255,255,255,0.5)] flex items-center gap-4">
                        <FaRedo /> REBOOT SYSTEM
                    </button>
                </div>
            )}
        </div>
    );
};

export default CarGame;
