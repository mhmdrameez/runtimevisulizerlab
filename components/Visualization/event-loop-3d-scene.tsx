"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line, Text } from "@react-three/drei";
import * as THREE from "three";

type Phase = "idle" | "macro" | "micro" | "stack" | "console";

interface EventLoopThreeSceneProps {
  stepId: string;
  callStack: string[];
  microtasks: string[];
  macrotasks: string[];
  webApis: string[];
  hasConsoleOutput: boolean;
  phase: Phase;
  heightClassName?: string;
  executionContextName: string;
  executionPhase: "creation" | "execution";
  executionBindings: string[];
}

function NodeBox({
  position,
  color,
  title,
  subtitle,
  lines = [],
}: {
  position: [number, number, number];
  color: string;
  title: string;
  subtitle?: string;
  lines?: string[];
}) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[3.2, 1.2, 0.7]} />
        <meshStandardMaterial color={color} metalness={0.15} roughness={0.4} />
      </mesh>
      <Text position={[0, 0.16, 0.4]} fontSize={0.26} color="#f8fafc" anchorX="center" anchorY="middle" outlineWidth={0.01} outlineColor="#020617">
        {title}
      </Text>
      {subtitle ? (
        <Text position={[0, -0.2, 0.4]} fontSize={0.17} color="#f1f5f9" anchorX="center" anchorY="middle" outlineWidth={0.01} outlineColor="#020617">
          {subtitle}
        </Text>
      ) : null}
      {lines.slice(0, 3).map((line, index) => (
        <Text
          key={`${title}-${line}-${index}`}
          position={[-1.42, -0.46 - index * 0.18, 0.4]}
          fontSize={0.12}
          color="#e2e8f0"
          anchorX="left"
          anchorY="middle"
          outlineWidth={0.006}
          outlineColor="#020617"
        >
          {`- ${line}`}
        </Text>
      ))}
    </group>
  );
}

function ArrowPath({
  points,
  color,
  label,
}: {
  points: [number, number, number][];
  color: string;
  label: string;
}) {
  const start = new THREE.Vector3(...points[0]);
  const end = new THREE.Vector3(...points[points.length - 1]);
  const direction = new THREE.Vector3().subVectors(end, start).normalize();
  const headPos = new THREE.Vector3().copy(end).addScaledVector(direction, -0.22);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction,
  );
  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

  return (
    <group>
      <Line points={points} color={color} lineWidth={1.2} dashed dashSize={0.25} gapSize={0.16} />
      <mesh position={headPos} quaternion={quaternion}>
        <coneGeometry args={[0.08, 0.2, 14]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} />
      </mesh>
      <Text position={[mid.x, mid.y + 0.23, 0.35]} fontSize={0.13} color={color} anchorX="center" anchorY="middle" outlineWidth={0.008} outlineColor="#020617">
        {label}
      </Text>
    </group>
  );
}

function FlowPulse({
  stepId,
  active,
  curve,
  color,
  label,
}: {
  stepId: string;
  active: boolean;
  curve: THREE.CatmullRomCurve3;
  color: string;
  label: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const startTimeRef = useRef(0);

  useEffect(() => {
    startTimeRef.current = performance.now();
  }, [stepId]);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    const elapsed = (performance.now() - startTimeRef.current) / 1000;
    const duration = 1.1;
    const progress = Math.min(elapsed / duration, 1);
    const t = active ? progress : 0;
    const point = curve.getPointAt(t);
    group.position.copy(point);
  });

  return (
    <group ref={groupRef} visible={active}>
      <mesh castShadow>
        <sphereGeometry args={[0.24, 24, 24]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} />
      </mesh>
      <mesh position={[0, 0.34, 0.02]}>
        <planeGeometry args={[0.72, 0.18]} />
        <meshBasicMaterial color="#111827" transparent opacity={0.9} />
      </mesh>
      <Text position={[0, 0.34, 0.03]} fontSize={0.14} color="#f9fafb" anchorX="center" anchorY="middle" outlineWidth={0.006} outlineColor="#020617">
        {label}
      </Text>
    </group>
  );
}

function SceneContent({
  stepId,
  callStack,
  microtasks,
  macrotasks,
  webApis,
  hasConsoleOutput,
  phase,
  executionContextName,
  executionPhase,
  executionBindings,
}: EventLoopThreeSceneProps) {
  const apiToMacro = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(4.9, 1.15, 0.1),
        new THREE.Vector3(3.6, 2.0, 0.2),
        new THREE.Vector3(1.4, 1.15, 0.1),
      ]),
    [],
  );

  const apiToMicro = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(4.9, 1.15, 0.1),
        new THREE.Vector3(3.6, 0.2, 0.2),
        new THREE.Vector3(1.4, -0.02, 0.1),
      ]),
    [],
  );

  const macroToStack = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.2, 1.15, 0.1),
        new THREE.Vector3(-1.4, 2.0, 0.2),
        new THREE.Vector3(-3.3, 1.15, 0.1),
      ]),
    [],
  );

  const microToStack = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.2, -0.02, 0.1),
        new THREE.Vector3(-1.4, 0.5, 0.2),
        new THREE.Vector3(-3.3, 1.15, 0.1),
      ]),
    [],
  );

  const stackToConsole = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-3.3, 1.15, 0.1),
        new THREE.Vector3(-1.8, -0.8, 0.2),
        new THREE.Vector3(0, -1.6, 0.1),
      ]),
    [],
  );

  const phaseText =
    phase === "stack"
      ? "Call Stack Push / Pop"
      : phase === "macro"
        ? "Macrotask Enqueue"
        : phase === "micro"
          ? "Microtask Enqueue"
          : phase === "console"
            ? "console.log Execution"
            : "Waiting";

  return (
    <>
      <color attach="background" args={["#070b14"]} />
      <ambientLight intensity={0.62} />
      <directionalLight position={[4, 7, 10]} intensity={1.2} castShadow />

      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.2, 0]}>
        <planeGeometry args={[16, 10]} />
        <meshStandardMaterial color="#0c1427" roughness={0.9} metalness={0.08} />
      </mesh>

      <NodeBox
        position={[-4.8, 1.15, 0]}
        color="#f59e0b"
        title="Call Stack"
        subtitle={`${callStack.length} frame(s)`}
        lines={callStack.length ? [...callStack].reverse() : ["(empty)"]}
      />
      <NodeBox
        position={[0, 1.15, 0]}
        color="#22c55e"
        title="Callback Queue"
        subtitle={`${macrotasks.length}`}
        lines={macrotasks.length ? macrotasks : ["(empty)"]}
      />
      <NodeBox
        position={[0, -0.02, 0]}
        color="#10b981"
        title="Priority Queue"
        subtitle={`${microtasks.length}`}
        lines={microtasks.length ? microtasks : ["(empty)"]}
      />
      <NodeBox
        position={[4.8, 1.15, 0]}
        color="#fb7185"
        title="Web APIs"
        subtitle={`${webApis.length} active`}
        lines={webApis.length ? webApis : ["(idle)"]}
      />
      <NodeBox position={[0, -1.6, 0]} color="#0ea5e9" title="Console" subtitle={hasConsoleOutput ? "visible" : "waiting"} />
      <NodeBox
        position={[4.8, -1.2, 0]}
        color="#8b5cf6"
        title="Execution Context"
        subtitle={`${executionContextName} (${executionPhase})`}
        lines={executionBindings.length ? executionBindings : ["(no bindings)"]}
      />

      <ArrowPath points={[[4.2, 1.15, 0.25], [2.2, 1.9, 0.25], [0.9, 1.15, 0.25]]} color="#fbbf24" label="enqueue" />
      <ArrowPath points={[[4.2, 1.1, 0.2], [2.2, 0.15, 0.2], [0.9, -0.02, 0.2]]} color="#34d399" label="priority" />
      <ArrowPath points={[[-0.8, 1.15, 0.25], [-2.0, 1.9, 0.25], [-4.0, 1.15, 0.25]]} color="#fde047" label="dequeue -> push" />
      <ArrowPath points={[[-0.8, -0.02, 0.2], [-2.0, 0.45, 0.2], [-4.0, 1.15, 0.2]]} color="#a7f3d0" label="micro -> push" />
      <ArrowPath points={[[-4.0, 1.15, 0.25], [-2.0, -0.8, 0.25], [-0.6, -1.6, 0.25]]} color="#38bdf8" label="console.log" />

      <FlowPulse stepId={stepId} active={phase === "macro"} curve={apiToMacro} color="#fbbf24" label="macro" />
      <FlowPulse stepId={stepId} active={phase === "micro"} curve={apiToMicro} color="#34d399" label="micro" />
      <FlowPulse stepId={stepId} active={phase === "stack"} curve={macroToStack} color="#fde047" label="push" />
      <FlowPulse stepId={stepId} active={phase === "stack"} curve={microToStack} color="#a7f3d0" label="pop" />
      <FlowPulse stepId={stepId} active={phase === "console"} curve={stackToConsole} color="#38bdf8" label="log" />

      <Text position={[0, 2.3, 0.2]} fontSize={0.24} color="#f8fafc" anchorX="center" anchorY="middle" outlineWidth={0.01} outlineColor="#020617">
        {phaseText}
      </Text>
    </>
  );
}

export function EventLoopThreeScene({ heightClassName = "h-[340px]", ...props }: EventLoopThreeSceneProps) {
  return (
    <div className={`${heightClassName} w-full overflow-hidden rounded-xl border border-zinc-700 bg-[#070b14]`}>
      <Canvas shadows camera={{ position: [0, 0.6, 11], fov: 35 }}>
        <SceneContent {...props} />
      </Canvas>
    </div>
  );
}
