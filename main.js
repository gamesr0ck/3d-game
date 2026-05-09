const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);

class BoxEntity {
    constructor(name, x, z, height, scene) {
        this.mesh = BABYLON.MeshBuilder.CreateBox(name, { width: 2, depth: 2, height: height }, scene);
        this.mesh.position.x = x;
        this.mesh.position.z = z;
        this.mesh.position.y = height / 2;
        this.mesh.checkCollisions = true;
        
        const mat = new BABYLON.StandardMaterial(name + "Mat", scene);
        mat.diffuseColor = new BABYLON.Color3(Math.random(), Math.random(), Math.random());
        this.mesh.material = mat;
    }
}

class PlayerEntity {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        
        // Physics properties
        this.speed = 0.15;
        this.jumpForce = 0.3;
        this.gravity = -0.015;
        this.yVelocity = 0;
        this.isGrounded = false;
        
        // Health properties
        this.health = 10;
        this.invulnerableTimer = 0;

        // Create the invisible collision capsule
        this.mesh = BABYLON.MeshBuilder.CreateCapsule("player", { radius: 0.5, height: 2 }, scene);
        this.mesh.position.y = 1;
        this.mesh.checkCollisions = true;
        this.mesh.ellipsoid = new BABYLON.Vector3(0.5, 1, 0.5);
        this.mesh.ellipsoidOffset = new BABYLON.Vector3(0, 0, 0);
        this.mesh.isVisible = false;
        
        this.buildBodyParts();
    }
    
    buildBodyParts() {
        const scene = this.scene;
        
        // Create materials for the person
        const skinMat = new BABYLON.StandardMaterial("skinMat", scene);
        skinMat.diffuseColor = new BABYLON.Color3(1.0, 0.8, 0.6); // Peach/skin color
        
        const shirtMat = new BABYLON.StandardMaterial("shirtMat", scene);
        shirtMat.diffuseColor = new BABYLON.Color3(0.2, 0.6, 1.0); // Blue shirt
        
        const pantsMat = new BABYLON.StandardMaterial("pantsMat", scene);
        pantsMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.2); // Dark pants

        // Build the person's body parts and parent them to the invisible capsule
        const head = BABYLON.MeshBuilder.CreateBox("head", { size: 0.5 }, scene);
        head.parent = this.mesh;
        head.position.y = 0.75;
        head.material = skinMat;

        const body = BABYLON.MeshBuilder.CreateBox("body", { width: 0.6, height: 0.7, depth: 0.3 }, scene);
        body.parent = this.mesh;
        body.position.y = 0.15;
        body.material = shirtMat;

        const leftArm = BABYLON.MeshBuilder.CreateBox("leftArm", { width: 0.2, height: 0.7, depth: 0.2 }, scene);
        leftArm.parent = this.mesh;
        leftArm.position.x = -0.4;
        leftArm.position.y = 0.15;
        leftArm.material = skinMat;

        const rightArm = BABYLON.MeshBuilder.CreateBox("rightArm", { width: 0.2, height: 0.7, depth: 0.2 }, scene);
        rightArm.parent = this.mesh;
        rightArm.position.x = 0.4;
        rightArm.position.y = 0.15;
        rightArm.material = skinMat;

        const leftLeg = BABYLON.MeshBuilder.CreateBox("leftLeg", { width: 0.25, height: 0.8, depth: 0.25 }, scene);
        leftLeg.parent = this.mesh;
        leftLeg.position.x = -0.15;
        leftLeg.position.y = -0.6;
        leftLeg.material = pantsMat;

        const rightLeg = BABYLON.MeshBuilder.CreateBox("rightLeg", { width: 0.25, height: 0.8, depth: 0.25 }, scene);
        rightLeg.parent = this.mesh;
        rightLeg.position.x = 0.15;
        rightLeg.position.y = -0.6;
        rightLeg.material = pantsMat;
    }
    
    update(inputMap, engine, enemies) {
        let moved = false;
        
        // Calculate forward and right directions based on camera
        const forward = this.camera.getFrontPosition(1).subtract(this.camera.position);
        forward.y = 0;
        if (forward.lengthSquared() > 0.001) forward.normalize();
        
        const right = BABYLON.Vector3.Cross(new BABYLON.Vector3(0, 1, 0), forward).normalize();
        const moveVec = new BABYLON.Vector3(0, 0, 0);

        // Movement input
        if (inputMap["w"] || inputMap["arrowup"]) { moveVec.addInPlace(forward.scale(this.speed)); moved = true; }
        if (inputMap["s"] || inputMap["arrowdown"]) { moveVec.addInPlace(forward.scale(-this.speed)); moved = true; }
        if (inputMap["a"] || inputMap["arrowleft"]) { moveVec.addInPlace(right.scale(-this.speed)); moved = true; }
        if (inputMap["d"] || inputMap["arrowright"]) { moveVec.addInPlace(right.scale(this.speed)); moved = true; }

        // Face the movement direction
        if (moved && moveVec.lengthSquared() > 0.001) {
            this.mesh.rotation.y = Math.atan2(moveVec.x, moveVec.z);
        }

        // Apply gravity and jumping
        this.yVelocity += this.gravity;
        if (inputMap[" "] && this.isGrounded) {
            this.yVelocity = this.jumpForce;
            this.isGrounded = false;
        }

        moveVec.y = this.yVelocity;
        const oldY = this.mesh.position.y;
        
        // Move player considering collisions
        this.mesh.moveWithCollisions(moveVec);

        // Check vertical collision (ground or ceiling)
        if (this.yVelocity < 0 && this.mesh.position.y >= oldY - 0.001) {
            this.isGrounded = true;
            this.yVelocity = 0;
        } else if (this.yVelocity > 0 && this.mesh.position.y <= oldY + 0.001) {
            this.yVelocity = 0;
        } else {
            this.isGrounded = false;
        }

        // Keep player on the map
        const bounds = 24.5;
        if (this.mesh.position.x > bounds) this.mesh.position.x = bounds;
        if (this.mesh.position.x < -bounds) this.mesh.position.x = -bounds;
        if (this.mesh.position.z > bounds) this.mesh.position.z = bounds;
        if (this.mesh.position.z < -bounds) this.mesh.position.z = -bounds;
        
        // Reset if falling off (just a safety net)
        if (this.mesh.position.y < -10) {
            this.mesh.position.y = 10;
            this.yVelocity = 0;
        }

        // Handle enemy collisions and health
        if (this.invulnerableTimer > 0) {
            this.invulnerableTimer -= engine.getDeltaTime();
            // Blinking effect when hurt
            const visible = (Math.floor(Date.now() / 100) % 2 === 0);
            this.mesh.getChildMeshes().forEach(m => m.visibility = visible ? 0.5 : 1.0);
        } else {
            // Reset visibility
            this.mesh.getChildMeshes().forEach(m => m.visibility = 1.0);
            
            // Check collisions
            for (const enemy of enemies) {
                if (this.mesh.intersectsMesh(enemy.mesh, false)) {
                    this.health -= 1;
                    this.invulnerableTimer = 1000; // 1 second of invulnerability
                    
                    const healthDisplay = document.getElementById("healthDisplay");
                    if (healthDisplay) healthDisplay.innerText = "Health: " + this.health;
                    
                    if (this.health <= 0) {
                        alert("Game Over! You ran out of health.");
                        this.health = 10;
                        if (healthDisplay) healthDisplay.innerText = "Health: " + this.health;
                        // Respawn
                        this.mesh.position = new BABYLON.Vector3(0, 5, 0);
                        this.yVelocity = 0;
                    }
                    break; // Take damage from at most one enemy per frame
                }
            }
        }
    }
}
class EnemyEntity {
    constructor(scene, x, z) {
        this.scene = scene;
        
        // Physics and movement properties
        this.speed = 0.05; // slower than player
        this.gravity = -0.015;
        this.yVelocity = 0;
        this.changeDirectionTimer = 0;
        this.moveDirection = new BABYLON.Vector3(0, 0, 0);

        // Create the invisible collision capsule
        this.mesh = BABYLON.MeshBuilder.CreateCapsule("enemy", { radius: 0.5, height: 2 }, scene);
        this.mesh.position.x = x;
        this.mesh.position.y = 1;
        this.mesh.position.z = z;
        this.mesh.checkCollisions = true;
        this.mesh.ellipsoid = new BABYLON.Vector3(0.5, 1, 0.5);
        this.mesh.ellipsoidOffset = new BABYLON.Vector3(0, 0, 0);
        this.mesh.isVisible = false;
        
        this.buildBodyParts();
    }
    
    buildBodyParts() {
        const scene = this.scene;
        
        // Create materials for the enemy person
        const skinMat = new BABYLON.StandardMaterial("enemySkinMat", scene);
        skinMat.diffuseColor = new BABYLON.Color3(1.0, 0.4, 0.4); // Reddish skin
        
        const shirtMat = new BABYLON.StandardMaterial("enemyShirtMat", scene);
        shirtMat.diffuseColor = new BABYLON.Color3(0.8, 0.1, 0.1); // Red shirt
        
        const pantsMat = new BABYLON.StandardMaterial("enemyPantsMat", scene);
        pantsMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.1); // Dark pants

        // Build the person's body parts and parent them to the invisible capsule
        const head = BABYLON.MeshBuilder.CreateBox("e_head", { size: 0.5 }, scene);
        head.parent = this.mesh;
        head.position.y = 0.75;
        head.material = skinMat;

        const body = BABYLON.MeshBuilder.CreateBox("e_body", { width: 0.6, height: 0.7, depth: 0.3 }, scene);
        body.parent = this.mesh;
        body.position.y = 0.15;
        body.material = shirtMat;

        const leftArm = BABYLON.MeshBuilder.CreateBox("e_leftArm", { width: 0.2, height: 0.7, depth: 0.2 }, scene);
        leftArm.parent = this.mesh;
        leftArm.position.x = -0.4;
        leftArm.position.y = 0.15;
        leftArm.material = skinMat;

        const rightArm = BABYLON.MeshBuilder.CreateBox("e_rightArm", { width: 0.2, height: 0.7, depth: 0.2 }, scene);
        rightArm.parent = this.mesh;
        rightArm.position.x = 0.4;
        rightArm.position.y = 0.15;
        rightArm.material = skinMat;

        const leftLeg = BABYLON.MeshBuilder.CreateBox("e_leftLeg", { width: 0.25, height: 0.8, depth: 0.25 }, scene);
        leftLeg.parent = this.mesh;
        leftLeg.position.x = -0.15;
        leftLeg.position.y = -0.6;
        leftLeg.material = pantsMat;

        const rightLeg = BABYLON.MeshBuilder.CreateBox("e_rightLeg", { width: 0.25, height: 0.8, depth: 0.25 }, scene);
        rightLeg.parent = this.mesh;
        rightLeg.position.x = 0.15;
        rightLeg.position.y = -0.6;
        rightLeg.material = pantsMat;
    }
    
    update(engine) {
        // Change direction randomly
        this.changeDirectionTimer -= engine.getDeltaTime();
        if (this.changeDirectionTimer <= 0) {
            const angle = Math.random() * Math.PI * 2;
            this.moveDirection = new BABYLON.Vector3(Math.cos(angle), 0, Math.sin(angle));
            this.changeDirectionTimer = 1000 + Math.random() * 2000;
            
            // Randomly stop sometimes
            if (Math.random() < 0.3) {
                this.moveDirection = BABYLON.Vector3.Zero();
            }
        }

        const moveVec = this.moveDirection.scale(this.speed);

        // Face movement direction
        if (moveVec.lengthSquared() > 0.001) {
            this.mesh.rotation.y = Math.atan2(moveVec.x, moveVec.z);
        }

        // Apply gravity
        this.yVelocity += this.gravity;
        moveVec.y = this.yVelocity;
        
        const oldY = this.mesh.position.y;
        
        // Move with collisions
        this.mesh.moveWithCollisions(moveVec);

        // Reset vertical velocity on collision
        if (this.yVelocity < 0 && this.mesh.position.y >= oldY - 0.001) {
            this.yVelocity = 0;
        } else if (this.yVelocity > 0 && this.mesh.position.y <= oldY + 0.001) {
            this.yVelocity = 0;
        }

        // Map boundaries
        const bounds = 24.5;
        if (this.mesh.position.x > bounds) this.mesh.position.x = bounds;
        if (this.mesh.position.x < -bounds) this.mesh.position.x = -bounds;
        if (this.mesh.position.z > bounds) this.mesh.position.z = bounds;
        if (this.mesh.position.z < -bounds) this.mesh.position.z = -bounds;
        
        if (this.mesh.position.y < -10) {
            this.mesh.position.y = 10;
            this.yVelocity = 0;
        }
    }
}

const createScene = function () {
    const scene = new BABYLON.Scene(engine);
    scene.collisionsEnabled = true;
    scene.clearColor = new BABYLON.Color3(0.53, 0.81, 0.92);

    // Camera setup
    const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 10, BABYLON.Vector3.Zero(), scene);
    camera.attachControl(canvas, true);
    camera.keysUp = [];
    camera.keysDown = [];
    camera.keysLeft = [];
    camera.keysRight = [];
    camera.lowerRadiusLimit = 2;
    camera.upperRadiusLimit = 20;
    camera.upperBetaLimit = Math.PI / 2.2; 
    camera.checkCollisions = true;

    // Lighting
    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.7;
    const dirLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(-1, -2, -1), scene);
    dirLight.position = new BABYLON.Vector3(20, 40, 20);
    dirLight.intensity = 0.5;

    // Ground
    const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 50, height: 50 }, scene);
    ground.checkCollisions = true;
    const groundMat = new BABYLON.StandardMaterial("groundMat", scene);
    groundMat.diffuseColor = new BABYLON.Color3(0.3, 0.8, 0.3);
    groundMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
    ground.material = groundMat;

    // Populate the world with boxes using our BoxEntity class
    const boxes = [];
    for (let i = 0; i < 20; i++) {
        const height = Math.random() * 2 + 1;
        const x = (Math.random() - 0.5) * 40;
        const z = (Math.random() - 0.5) * 40;
        boxes.push(new BoxEntity("box" + i, x, z, height, scene));
    }

    // Populate enemies
    const enemies = [];
    for (let i = 0; i < 5; i++) {
        const x = (Math.random() - 0.5) * 40;
        const z = (Math.random() - 0.5) * 40;
        enemies.push(new EnemyEntity(scene, x, z));
    }

    // Create player and follow them with the camera
    const player = new PlayerEntity(scene, camera);
    camera.target = player.mesh;

    // Input Management
    const inputMap = {};
    scene.actionManager = new BABYLON.ActionManager(scene);
    scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyDownTrigger, evt => {
        inputMap[evt.sourceEvent.key.toLowerCase()] = evt.sourceEvent.type == "keydown";
    }));
    scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyUpTrigger, evt => {
        inputMap[evt.sourceEvent.key.toLowerCase()] = evt.sourceEvent.type == "keydown";
    }));

    // Game loop
    scene.onBeforeRenderObservable.add(() => {
        player.update(inputMap, engine, enemies);
        enemies.forEach(e => e.update(engine));
    });

    return scene;
};

// Call the createScene function
const scene = createScene();

// Register a render loop to repeatedly render the scene
engine.runRenderLoop(function () {
    scene.render();
});

// Watch for browser/canvas resize events
window.addEventListener("resize", function () {
    engine.resize();
});
