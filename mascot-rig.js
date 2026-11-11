import * as THREE from 'three';

// Pose in world space: Mixamo's left/right local axes are not interchangeable.
// Build each pose from the same rest transforms, then blend complete poses.
export function createMascotRig(model, pivot) {
  const bones = new Map();
  model.traverse(object => {
    if (object.isBone) bones.set(object.name.replace(/^.*[:|]/, '').replace(/^mixamorig[_:]?/i, ''), object);
  });
  const rest = new Map([...bones.values()].map(bone => [bone, {
    position: bone.position.clone(), rotation: bone.quaternion.clone(),
  }]));
  const position = bone => bone.getWorldPosition(new THREE.Vector3());
  const reset = () => {
    for (const [bone, value] of rest) {
      bone.position.copy(value.position);
      bone.quaternion.copy(value.rotation);
    }
    pivot.updateMatrixWorld(true);
  };
  function aim(name, childName, direction) {
    const bone = bones.get(name), child = bones.get(childName);
    if (!bone || !child) return;
    const from = position(child).sub(position(bone)).normalize();
    const to = new THREE.Vector3(...direction).normalize();
    const world = bone.getWorldQuaternion(new THREE.Quaternion());
    const parent = bone.parent.getWorldQuaternion(new THREE.Quaternion());
    const delta = new THREE.Quaternion().setFromUnitVectors(from, to);
    bone.quaternion.copy(parent.invert().multiply(delta.multiply(world)));
    pivot.updateMatrixWorld(true);
  }
  const footRotations = new Map(['LeftFoot', 'RightFoot'].map(name =>
    [name, bones.get(name)?.getWorldQuaternion(new THREE.Quaternion())]));
  const poses = {};
  for (const scene of ['home', 'gaming', 'dining']) {
    reset();
    const seated = scene !== 'home';
    if (seated && bones.has('Hips')) {
      const hips = bones.get('Hips');
      const point = position(hips);
      point.y -= 0.52;
      hips.position.copy(hips.parent.worldToLocal(point));
      pivot.updateMatrixWorld(true);
    }
    for (const [side, sign] of [['Left', 1], ['Right', -1]]) {
      aim(`${side}UpLeg`, `${side}Leg`, seated ? [sign * 0.12, -0.12, 1] : [sign * 0.06, -1, 0]);
      aim(`${side}Leg`, `${side}Foot`, seated ? [0, -1, -0.05] : [0, -1, 0]);
      const foot = bones.get(`${side}Foot`);
      if (foot && footRotations.get(`${side}Foot`)) {
        foot.quaternion.copy(foot.parent.getWorldQuaternion(new THREE.Quaternion()).invert()
          .multiply(footRotations.get(`${side}Foot`)));
        pivot.updateMatrixWorld(true);
      }
      // Elbows hang below shoulders. Forearms reach forward, never bend sideways.
      aim(`${side}Arm`, `${side}ForeArm`, seated ? [sign * 0.25, -1, 0.25] : [sign * 0.18, -1, 0.03]);
      aim(`${side}ForeArm`, `${side}Hand`, scene === 'gaming'
        ? [-sign * 0.6, -0.08, 1]
        : scene === 'dining' ? [-sign * 0.12, -0.5, 1] : [-sign * 0.12, -1, 0.14]);
      if (scene === 'dining') bones.get(`${side}Hand`)?.rotateY(sign * Math.PI / 2);
    }
    poses[scene] = new Map([...bones.values()].map(bone => [bone, {
      position: bone.position.clone(), rotation: bone.quaternion.clone(),
    }]));
  }
  reset();

  // A visible controller gives the relaxed hand pose a clear purpose.
  const controller = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12),
    new THREE.MeshStandardMaterial({ color: 0x343647, roughness: 0.8 }));
  body.scale.set(0.22, 0.07, 0.12);
  controller.add(body);
  for (const x of [-0.11, 0.11]) {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.025, 12),
      new THREE.MeshStandardMaterial({ color: 0xaaa7b8, roughness: 0.8 }));
    stick.position.set(x, 0.07, 0.01);
    controller.add(stick);
  }
  pivot.add(controller);
  const handPoint = new THREE.Vector3();
  const head = bones.get('Head');
  let initialized = false;
  return {
    update(scene, delta, time, still = false) {
      const weight = still || !initialized ? 1 : 1 - Math.exp(-delta * 8);
      for (const [bone, target] of poses[scene]) {
        bone.position.lerp(target.position, weight);
        bone.quaternion.slerp(target.rotation, weight);
      }
      if (head && !still) {
        // Add motion to the target, not cumulatively to the preceding frame.
        head.quaternion.copy(poses[scene].get(head).rotation)
          .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(
            Math.sin(time * 0.65) * 0.008, Math.sin(time * 0.4) * 0.018, 0)));
      }
      initialized = true;
      pivot.updateMatrixWorld(true);
      controller.visible = scene === 'gaming';
      if (controller.visible && bones.has('LeftHand') && bones.has('RightHand')) {
        handPoint.copy(position(bones.get('LeftHand'))).add(position(bones.get('RightHand'))).multiplyScalar(0.5);
        controller.position.copy(pivot.worldToLocal(handPoint));
        controller.position.z += 0.08;
        controller.position.y -= 0.025;
      }
    },
  };
}
