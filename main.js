const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);


class ArrowEntity {
    constructor(scene, position, direction, isEnemyArrow = false) {
        this.mesh = BABYLON.MeshBuilder.CreateCylinder("arrow", { diameter: 0.1, height: 1 }, scene);
        this.mesh.position.copyFrom(position);
        
        // Orient arrow along direction
        const target = position.add(direction);
        this.mesh.lookAt(target);
        this.mesh.rotation.x += Math.PI / 2; // adjust cylinder orientation
        
        const mat = new BABYLON.StandardMaterial("arrowMat", scene);
        mat.diffuseColor = isEnemyArrow ? new BABYLON.Color3(1, 0, 0) : new BABYLON.Color3(1, 1, 0); // Red if enemy arrow, Yellow if player arrow
        this.mesh.material = mat;
        
        this.velocity = direction.scale(isEnemyArrow ? 0.3 : 0.8);
        this.isEnemyArrow = isEnemyArrow;
        this.isDead = false;
        this.lifeTimer = 2000; // 2 seconds
    }
    
    update(engine) {
        this.mesh.position.addInPlace(this.velocity);
        this.lifeTimer -= engine.getDeltaTime();
        if (this.lifeTimer <= 0) {
            this.isDead = true;
            this.mesh.dispose();
        }
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
        this.hasWings = false;
        
        // Weapon properties
        this.activeWeapon = "sword"; // "sword", "bow", "whip"
        this.swordSwingTimer = 0;
        this.isSwinging = false;
        this.arrowCooldown = 0;
        this.zPressed = false;
        
        this.whipTimer = 0;
        this.isWhipping = false;
        this.whipHitEnemies = [];
        
        this.spearTimer = 0;
        this.isSpearing = false;
        this.spearHitEnemies = [];

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

        this.rightArm = BABYLON.MeshBuilder.CreateBox("rightArm", { width: 0.2, height: 0.7, depth: 0.2 }, scene);
        this.rightArm.parent = this.mesh;
        this.rightArm.position.x = 0.4;
        this.rightArm.position.y = 0.15;
        this.rightArm.material = skinMat;

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

        // Create the sword
        const swordMat = new BABYLON.StandardMaterial("swordMat", scene);
        swordMat.diffuseColor = new BABYLON.Color3(0.8, 0.8, 0.8);
        this.sword = BABYLON.MeshBuilder.CreateBox("sword", { width: 0.1, height: 1.5, depth: 0.2 }, scene);
        this.sword.parent = this.rightArm;
        this.sword.position = new BABYLON.Vector3(0, -0.5, 0.5);
        this.sword.rotation.x = Math.PI / 4;
        this.sword.material = swordMat;

        // Create the bow
        const bowMat = new BABYLON.StandardMaterial("bowMat", scene);
        bowMat.diffuseColor = new BABYLON.Color3(0.5, 0.3, 0.1);
        this.bow = BABYLON.MeshBuilder.CreateTorus("bow", { diameter: 0.8, thickness: 0.1, tessellation: 16 }, scene);
        this.bow.parent = this.rightArm;
        this.bow.position = new BABYLON.Vector3(0, -0.5, 0.5);
        this.bow.rotation.y = Math.PI / 2;
        this.bow.material = bowMat;

        // Create the whip
        const whipMat = new BABYLON.StandardMaterial("whipMat", scene);
        whipMat.diffuseColor = new BABYLON.Color3(0.4, 0.2, 0.0);
        this.whip = BABYLON.MeshBuilder.CreateCylinder("whip", { diameter: 0.1, height: 1 }, scene);
        this.whip.bakeTransformIntoVertices(BABYLON.Matrix.Translation(0, 0.5, 0));
        this.whip.parent = this.rightArm;
        this.whip.position = new BABYLON.Vector3(0, -0.5, 0.5);
        this.whip.rotation.x = Math.PI / 2;
        this.whip.material = whipMat;
        this.whip.scaling.y = 0.01;
        
        // Create the spear
        const spearMat = new BABYLON.StandardMaterial("spearMat", scene);
        spearMat.diffuseColor = new BABYLON.Color3(0.7, 0.7, 0.7); // Silver
        this.spear = BABYLON.MeshBuilder.CreateCylinder("spear", { diameter: 0.1, height: 1 }, scene);
        this.spear.bakeTransformIntoVertices(BABYLON.Matrix.Translation(0, 0.5, 0));
        this.spear.parent = this.rightArm;
        this.spear.position = new BABYLON.Vector3(0, -0.5, 0.5);
        this.spear.rotation.x = Math.PI / 2;
        this.spear.material = spearMat;
        this.spear.scaling.y = 1.5; // Idle length
        
        // Create the wings
        const wingsMat = new BABYLON.StandardMaterial("wingsMat", scene);
        wingsMat.diffuseColor = new BABYLON.Color3(1, 1, 1); // White wings
        
        this.wings = new BABYLON.TransformNode("wingsNode", scene);
        this.wings.parent = this.mesh;
        this.wings.position = new BABYLON.Vector3(0, 1.3, -0.3); // High on the back
        
        // Left Wing
        const leftWing = BABYLON.MeshBuilder.CreateCylinder("wings_left", { diameterTop: 0.8, diameterBottom: 0.1, height: 2, tessellation: 16 }, scene);
        leftWing.parent = this.wings;
        leftWing.position = new BABYLON.Vector3(-0.6, 0, 0);
        leftWing.rotation.z = Math.PI / 6; // Angle outwards
        leftWing.rotation.x = -Math.PI / 8; // Sweep backwards
        leftWing.scaling.z = 0.1; // Flatten it
        leftWing.material = wingsMat;
        leftWing.isVisible = false;
        
        // Right Wing
        const rightWing = BABYLON.MeshBuilder.CreateCylinder("wings_right", { diameterTop: 0.8, diameterBottom: 0.1, height: 2, tessellation: 16 }, scene);
        rightWing.parent = this.wings;
        rightWing.position = new BABYLON.Vector3(0.6, 0, 0);
        rightWing.rotation.z = -Math.PI / 6; // Angle outwards
        rightWing.rotation.x = -Math.PI / 8; // Sweep backwards
        rightWing.scaling.z = 0.1; // Flatten it
        rightWing.material = wingsMat;
        rightWing.isVisible = false;
        
        this.equipWeapon(this.activeWeapon);
    }
    
    equipWeapon(weaponName) {
        this.activeWeapon = weaponName;
        this.sword.isVisible = (weaponName === "sword");
        this.bow.isVisible = (weaponName === "bow");
        this.whip.isVisible = (weaponName === "whip");
        this.spear.isVisible = (weaponName === "spear");
    }

    takeDamage(amount) {
        if (this.invulnerableTimer > 0) return;
        this.health -= amount;
        this.invulnerableTimer = 1000; // 1 second of invulnerability
        
        // Lose wings upon taking damage
        if (this.hasWings) {
            this.hasWings = false;
            this.mesh.getChildMeshes().forEach(m => {
                if (m.name.startsWith("wings")) m.isVisible = false;
            });
        }
        
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
    }

    update(inputMap, engine, enemies, arrows) {
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

        // Flight with wings
        if (this.hasWings && inputMap["enter"]) {
            this.yVelocity = this.jumpForce * 0.6; // Fly up continuously
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
            this.mesh.getChildMeshes().forEach(m => {
                // Ensure inactive weapons stay invisible
                if (m.name === "sword" && this.activeWeapon !== "sword") m.isVisible = false;
                else if (m.name === "bow" && this.activeWeapon !== "bow") m.isVisible = false;
                else if (m.name === "whip" && this.activeWeapon !== "whip") m.isVisible = false;
                else if (m.name === "spear" && this.activeWeapon !== "spear") m.isVisible = false;
                else if (m.name.startsWith("wings") && !this.hasWings) m.isVisible = false;
                else if (m.name.startsWith("wings") && this.hasWings) m.isVisible = true;
                else m.visibility = 1.0;
            });
            
            // Check collisions with enemies
            for (const enemy of enemies) {
                if (this.mesh.intersectsMesh(enemy.mesh, false)) {
                    this.takeDamage(1);
                    break; // Take damage from at most one enemy per frame
                }
            }
        }

        // Weapon switching
        if (inputMap["z"] && !this.zPressed) {
            this.zPressed = true;
            if (this.activeWeapon === "sword") this.equipWeapon("bow");
            else if (this.activeWeapon === "bow") this.equipWeapon("whip");
            else if (this.activeWeapon === "whip") this.equipWeapon("spear");
            else this.equipWeapon("sword");
        } else if (!inputMap["z"]) {
            this.zPressed = false;
        }

        // Weapon logic
        if (this.arrowCooldown > 0) this.arrowCooldown -= engine.getDeltaTime();

        if (inputMap["c"] && !this.isSwinging && !this.isWhipping && !this.isSpearing) {
            if (this.activeWeapon === "sword") {
                this.isSwinging = true;
                this.swordSwingTimer = 300;
            } else if (this.activeWeapon === "bow" && this.arrowCooldown <= 0) {
                this.arrowCooldown = 500;
                
                // Shoot arrow
                const dir = new BABYLON.Vector3(Math.sin(this.mesh.rotation.y), 0, Math.cos(this.mesh.rotation.y));
                const pos = this.mesh.position.clone();
                pos.y += 0.5; // shoot from chest height
                arrows.push(new ArrowEntity(this.scene, pos, dir));
            } else if (this.activeWeapon === "whip") {
                this.isWhipping = true;
                this.whipTimer = 600;
                this.whipHitEnemies = [];
            } else if (this.activeWeapon === "spear") {
                this.isSpearing = true;
                this.spearTimer = 400;
                this.spearHitEnemies = [];
            }
        }

        if (this.isSwinging && this.activeWeapon === "sword") {
            this.swordSwingTimer -= engine.getDeltaTime();
            this.sword.rotation.x = -Math.PI / 2; // Swing down
            
            for (const enemy of enemies) {
                if (!enemy.isDead && this.sword.intersectsMesh(enemy.mesh, false)) {
                    enemy.takeDamage(2);
                }
            }

            if (this.swordSwingTimer <= 0) {
                this.isSwinging = false;
                this.sword.rotation.x = Math.PI / 4; // Rest position
            }
        }

        if (this.isWhipping && this.activeWeapon === "whip") {
            this.whipTimer -= engine.getDeltaTime();
            const t = 600 - this.whipTimer; // 0 to 600
            
            // Whip length: grows to 10 then shrinks
            let length = 0.01;
            if (t < 300) {
                length = Math.max(0.01, (t / 300) * 10);
            } else {
                length = Math.max(0.01, ((600 - t) / 300) * 10);
            }
            this.whip.scaling.y = length;

            for (const enemy of enemies) {
                if (!enemy.isDead && !this.whipHitEnemies.includes(enemy) && this.whip.intersectsMesh(enemy.mesh, false)) {
                    this.whipHitEnemies.push(enemy);
                    
                    // Critical hit (full damage = 2) if near max extension
                    if (t >= 200 && t <= 400) {
                        enemy.takeDamage(2);
                    } else {
                        // Half damage
                        enemy.takeDamage(1);
                    }
                }
            }

            if (this.whipTimer <= 0) {
                this.isWhipping = false;
                this.whip.scaling.y = 0.01;
            }
        }

        if (this.isSpearing && this.activeWeapon === "spear") {
            this.spearTimer -= engine.getDeltaTime();
            const t = 400 - this.spearTimer; // 0 to 400
            
            // Spear length: 1.5 -> 5 -> 1.5
            let length = 1.5;
            if (t < 200) {
                length = 1.5 + (t / 200) * 3.5;
            } else {
                length = 5 - ((t - 200) / 200) * 3.5;
            }
            this.spear.scaling.y = length;

            for (const enemy of enemies) {
                if (!enemy.isDead && !this.spearHitEnemies.includes(enemy) && this.spear.intersectsMesh(enemy.mesh, false)) {
                    this.spearHitEnemies.push(enemy);
                    enemy.takeDamage(2); // Defeats in one hit
                }
            }

            if (this.spearTimer <= 0) {
                this.isSpearing = false;
                this.spear.scaling.y = 1.5;
            }
        }
    }
}
class EnemyEntity {
    constructor(scene, x, z) {
        this.scene = scene;
        
        // Physics and movement properties
        this.speed = 0.05; // slower than player
        this.jumpForce = 0.3;
        this.gravity = -0.015;
        this.yVelocity = 0;
        this.changeDirectionTimer = 0;
        this.moveDirection = new BABYLON.Vector3(0, 0, 0);
        this.isDead = false;
        this.health = 2;
        this.hasWings = false;

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

        // Create wings for enemy (initially hidden)
        const wingsMat = new BABYLON.StandardMaterial("enemyWingsMat", scene);
        wingsMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
        
        this.wingsNode = new BABYLON.TransformNode("enemyWingsNode", scene);
        this.wingsNode.parent = this.mesh;
        this.wingsNode.position = new BABYLON.Vector3(0, 1.3, -0.3);
        
        const leftWing = BABYLON.MeshBuilder.CreateCylinder("e_wings_left", { diameterTop: 0.8, diameterBottom: 0.1, height: 2, tessellation: 16 }, scene);
        leftWing.parent = this.wingsNode;
        leftWing.position = new BABYLON.Vector3(-0.6, 0, 0);
        leftWing.rotation.z = Math.PI / 6;
        leftWing.rotation.x = -Math.PI / 8;
        leftWing.scaling.z = 0.1;
        leftWing.material = wingsMat;
        leftWing.isVisible = false;
        
        const rightWing = BABYLON.MeshBuilder.CreateCylinder("e_wings_right", { diameterTop: 0.8, diameterBottom: 0.1, height: 2, tessellation: 16 }, scene);
        rightWing.parent = this.wingsNode;
        rightWing.position = new BABYLON.Vector3(0.6, 0, 0);
        rightWing.rotation.z = -Math.PI / 6;
        rightWing.rotation.x = -Math.PI / 8;
        rightWing.scaling.z = 0.1;
        rightWing.material = wingsMat;
        rightWing.isVisible = false;
    }

    takeDamage(amount) {
        if (this.hasWings) {
            this.hasWings = false;
            this.mesh.getChildMeshes().forEach(m => {
                if (m.name.startsWith("e_wings")) m.isVisible = false;
            });
        }
        
        this.health -= amount;
        if (this.health <= 0) {
            this.isDead = true;
            this.mesh.dispose();
        }
    }
    
    update(engine, player, arrows) {
        if (this.hasWings) {
            // Flying behavior towards player
            const dir = player.mesh.position.subtract(this.mesh.position);
            if (dir.lengthSquared() > 0.001) {
                dir.normalize();
                this.mesh.position.addInPlace(dir.scale(this.speed)); 
                this.mesh.rotation.y = Math.atan2(dir.x, dir.z);
            }
            
            // Map boundaries
            const bounds = 24.5;
            if (this.mesh.position.x > bounds) this.mesh.position.x = bounds;
            if (this.mesh.position.x < -bounds) this.mesh.position.x = -bounds;
            if (this.mesh.position.z > bounds) this.mesh.position.z = bounds;
            if (this.mesh.position.z < -bounds) this.mesh.position.z = -bounds;
            if (this.mesh.position.y > 20) this.mesh.position.y = 20;
            return;
        }

        // Change direction randomly
        this.changeDirectionTimer -= engine.getDeltaTime();
        if (this.changeDirectionTimer <= 0) {
            const angle = Math.random() * Math.PI * 2;
            this.moveDirection = new BABYLON.Vector3(Math.cos(angle), 0, Math.sin(angle));
            this.changeDirectionTimer = 1000 + Math.random() * 2000;
            
            // Randomly stop sometimes
            if (Math.random() < 0.3) {
                this.moveDirection = BABYLON.Vector3.Zero();
            } else if (this.yVelocity === 0 && Math.random() < 0.4) {
                this.yVelocity = this.jumpForce; // Jump!
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

class FlyingEnemyEntity {
    constructor(scene, x, z) {
        this.scene = scene;
        this.speed = 0.05;
        this.isDead = false;
        this.health = 2;
        this.moveDirection = new BABYLON.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
        this.changeDirectionTimer = 0;
        this.shootTimer = 2000; // shoot every 2 seconds

        // Flying high in the sky
        this.mesh = BABYLON.MeshBuilder.CreateBox("flyingEnemy", { size: 1.5 }, scene);
        this.mesh.position.x = x;
        this.mesh.position.y = 30; // High in the sky
        this.mesh.position.z = z;
        this.mesh.checkCollisions = true;

        const mat = new BABYLON.StandardMaterial("flyingEnemyMat", scene);
        mat.diffuseColor = new BABYLON.Color3(0.8, 0, 0.8); // Purple
        this.mesh.material = mat;
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) {
            this.isDead = true;
            this.mesh.dispose();
        }
    }

    update(engine, player, arrows) {
        // Movement
        this.changeDirectionTimer -= engine.getDeltaTime();
        if (this.changeDirectionTimer <= 0) {
            const angle = Math.random() * Math.PI * 2;
            this.moveDirection = new BABYLON.Vector3(Math.cos(angle), 0, Math.sin(angle));
            this.changeDirectionTimer = 1000 + Math.random() * 2000;
        }

        const moveVec = this.moveDirection.scale(this.speed);
        this.mesh.position.addInPlace(moveVec);

        // Keep in bounds
        const bounds = 24.5;
        if (this.mesh.position.x > bounds) this.mesh.position.x = bounds;
        if (this.mesh.position.x < -bounds) this.mesh.position.x = -bounds;
        if (this.mesh.position.z > bounds) this.mesh.position.z = bounds;
        if (this.mesh.position.z < -bounds) this.mesh.position.z = -bounds;

        // Face player
        this.mesh.lookAt(player.mesh.position);

        // Shooting
        this.shootTimer -= engine.getDeltaTime();
        if (this.shootTimer <= 0) {
            this.shootTimer = 2000 + Math.random() * 1000; // 2-3 seconds
            const dir = player.mesh.position.subtract(this.mesh.position).normalize();
            arrows.push(new ArrowEntity(this.scene, this.mesh.position.clone(), dir, true));
        }
    }
}

class DragonEntity {
    constructor(scene, x, z) {
        this.scene = scene;
        this.speed = 0.08;
        this.isDead = false;
        this.health = 10;
        this.moveDirection = new BABYLON.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
        this.changeDirectionTimer = 0;
        this.shootTimer = 1500;
        
        this.gravity = -0.015;
        this.yVelocity = 0;

        this.mesh = BABYLON.MeshBuilder.CreateCapsule("dragon", { radius: 1, height: 3 }, scene);
        this.mesh.position.x = x;
        this.mesh.position.y = 1.5;
        this.mesh.position.z = z;
        this.mesh.checkCollisions = true;
        this.mesh.ellipsoid = new BABYLON.Vector3(1, 1.5, 1);
        this.mesh.ellipsoidOffset = new BABYLON.Vector3(0, 0, 0);
        this.mesh.isVisible = false;

        this.buildBodyParts();
    }
    
    buildBodyParts() {
        const scene = this.scene;
        
        const scaleMat = new BABYLON.StandardMaterial("dragonScaleMat", scene);
        scaleMat.diffuseColor = new BABYLON.Color3(0.1, 0.6, 0.1);
        
        const bellyMat = new BABYLON.StandardMaterial("dragonBellyMat", scene);
        bellyMat.diffuseColor = new BABYLON.Color3(0.6, 0.8, 0.2);
        
        const wingMat = new BABYLON.StandardMaterial("dragonWingMat", scene);
        wingMat.diffuseColor = new BABYLON.Color3(0.05, 0.4, 0.05);
        
        const body = BABYLON.MeshBuilder.CreateCylinder("d_body", { diameterTop: 1, diameterBottom: 1.5, height: 2 }, scene);
        body.parent = this.mesh;
        body.position.y = 0;
        body.rotation.x = Math.PI / 4;
        body.material = scaleMat;
        
        const head = BABYLON.MeshBuilder.CreateBox("d_head", { width: 0.8, height: 0.8, depth: 1.2 }, scene);
        head.parent = this.mesh;
        head.position = new BABYLON.Vector3(0, 1.2, 0.8);
        head.material = scaleMat;
        
        const snout = BABYLON.MeshBuilder.CreateBox("d_snout", { width: 0.6, height: 0.4, depth: 0.8 }, scene);
        snout.parent = head;
        snout.position = new BABYLON.Vector3(0, -0.2, 0.8);
        snout.material = bellyMat;
        
        const leftWing = BABYLON.MeshBuilder.CreateCylinder("d_wingL", { diameterTop: 3, diameterBottom: 0.1, height: 0.1, tessellation: 3 }, scene);
        leftWing.parent = this.mesh;
        leftWing.position = new BABYLON.Vector3(-1.2, 0.5, -0.5);
        leftWing.rotation.z = Math.PI / 6;
        leftWing.rotation.y = -Math.PI / 8;
        leftWing.material = wingMat;
        
        const rightWing = BABYLON.MeshBuilder.CreateCylinder("d_wingR", { diameterTop: 3, diameterBottom: 0.1, height: 0.1, tessellation: 3 }, scene);
        rightWing.parent = this.mesh;
        rightWing.position = new BABYLON.Vector3(1.2, 0.5, -0.5);
        rightWing.rotation.z = -Math.PI / 6;
        rightWing.rotation.y = Math.PI / 8;
        rightWing.material = wingMat;
        
        const tail = BABYLON.MeshBuilder.CreateCylinder("d_tail", { diameterTop: 0.8, diameterBottom: 0.1, height: 2 }, scene);
        tail.parent = this.mesh;
        tail.position = new BABYLON.Vector3(0, -0.8, -1);
        tail.rotation.x = -Math.PI / 3;
        tail.material = scaleMat;
        
        this.wings = [leftWing, rightWing];
    }
    
    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) {
            this.isDead = true;
            this.mesh.dispose();
        }
    }
    
    update(engine, player, arrows) {
        const time = Date.now() / 200;
        this.wings[0].rotation.z = Math.PI / 6 + Math.sin(time) * 0.2;
        this.wings[1].rotation.z = -Math.PI / 6 - Math.sin(time) * 0.2;
        
        const dir = player.mesh.position.subtract(this.mesh.position);
        dir.y = 0;
        
        if (dir.lengthSquared() > 0.001) {
            this.mesh.rotation.y = Math.atan2(dir.x, dir.z);
        }
        
        if (dir.length() > 5) {
            const moveVec = dir.normalize().scale(this.speed);
            this.yVelocity += this.gravity;
            moveVec.y = this.yVelocity;
            
            const oldY = this.mesh.position.y;
            this.mesh.moveWithCollisions(moveVec);
            
            if (this.yVelocity < 0 && this.mesh.position.y >= oldY - 0.001) {
                this.yVelocity = 0;
            }
        }
        
        this.shootTimer -= engine.getDeltaTime();
        if (this.shootTimer <= 0) {
            this.shootTimer = 1500 + Math.random() * 1000;
            const shootDir = player.mesh.position.subtract(this.mesh.position).normalize();
            const pos = this.mesh.position.clone();
            pos.y += 1.2;
            arrows.push(new ArrowEntity(this.scene, pos, shootDir, true));
        }
        
        const bounds = 24.5;
        if (this.mesh.position.x > bounds) this.mesh.position.x = bounds;
        if (this.mesh.position.x < -bounds) this.mesh.position.x = -bounds;
        if (this.mesh.position.z > bounds) this.mesh.position.z = bounds;
        if (this.mesh.position.z < -bounds) this.mesh.position.z = -bounds;
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
    camera.inertia = 0; // Prevent camera drift momentum

    // Lighting
    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.7;
    const dirLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(-1, -2, -1), scene);
    dirLight.position = new BABYLON.Vector3(20, 40, 20);
    dirLight.intensity = 0.5;

    // Ground
    const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 50, height: 50, subdivisions: 64, updatable: true }, scene);
    ground.checkCollisions = true;
    const groundMat = new BABYLON.StandardMaterial("groundMat", scene);
    groundMat.diffuseColor = new BABYLON.Color3(0.3, 0.8, 0.3);
    groundMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
    ground.material = groundMat;
    let enemies = [];
    let currentLevel = 1;

    function generateLevel() {
        for (let enemy of enemies) {
            if (enemy.mesh) enemy.mesh.dispose();
        }
        enemies = [];

        // Generate procedural terrain
        const positions = ground.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        const seed1 = Math.random() * 100;
        const seed2 = Math.random() * 100;
        const seed3 = Math.random() * 100;
        
        for (let i = 0; i < positions.length; i += 3) {
            const x = positions[i];
            const z = positions[i + 2];
            
            // Protect center spawn area
            const distToCenter = Math.sqrt(x*x + z*z);
            let height = 0;
            
            if (distToCenter > 6) {
                // Procedural generation using sine waves for hills and cliffs
                const wave1 = Math.sin(x * 0.2 + seed1) * Math.cos(z * 0.2 + seed1) * 2.0; // rolling hills
                const wave2 = Math.sin(x * 0.5 + seed2) * Math.sin(z * 0.4 + seed2) * 1.5; // smaller bumps
                const wave3 = Math.sin(x * 0.1 + seed3) * Math.cos(z * 0.1 + seed3) * 5.0; // large cliffs
                
                height = wave1 + wave2 + wave3;
                
                // Keep base level mostly flat, add sharp cliffs
                if (height < 1.0) {
                    height = 0; // Flat ground
                } else {
                    height = height - 1.0; // Start rising
                }
                
                // Add steepness for cliffs
                if (height > 3.0) {
                    height += 2.0;
                }
                
                // Blend with center
                if (distToCenter < 12) {
                    height *= (distToCenter - 6) / 6; 
                }
            }
            
            positions[i + 1] = height;
        }
        
        ground.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
        
        const normals = [];
        BABYLON.VertexData.ComputeNormals(positions, ground.getIndices(), normals);
        ground.updateVerticesData(BABYLON.VertexBuffer.NormalKind, normals);
        
        // Force refresh of bounding info for collisions
        ground.refreshBoundingInfo();

        // The level will start with 2 more enemies than before.
        const totalExtraEnemies = (currentLevel - 1) * 2;
        const extraFlying = Math.floor(totalExtraEnemies / 3); // distribute some to flying
        const extraGround = totalExtraEnemies - extraFlying;

        // Populate ground enemies
        for (let i = 0; i < 4 + extraGround; i++) {
            let x = (Math.random() - 0.5) * 40;
            let z = (Math.random() - 0.5) * 40;
            while (Math.abs(x) < 5 && Math.abs(z) < 5) {
                x = (Math.random() - 0.5) * 40;
                z = (Math.random() - 0.5) * 40;
            }
            enemies.push(new EnemyEntity(scene, x, z));
        }
        
        // Populate flying enemies
        for (let i = 0; i < 1 + extraFlying; i++) {
            let x = (Math.random() - 0.5) * 40;
            let z = (Math.random() - 0.5) * 40;
            while (Math.abs(x) < 5 && Math.abs(z) < 5) {
                x = (Math.random() - 0.5) * 40;
                z = (Math.random() - 0.5) * 40;
            }
            enemies.push(new FlyingEnemyEntity(scene, x, z));
        }

        if (currentLevel === 1) {
            // Spawn a dragon in front of the player when you start the game
            enemies.push(new DragonEntity(scene, 0, 8));
        }

        const levelDisplay = document.getElementById("levelDisplay");
        if (levelDisplay) levelDisplay.innerText = "Level: " + currentLevel;
    }

    generateLevel();

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

    // Prevent keys from getting stuck if window loses focus
    window.addEventListener("blur", () => {
        for (let key in inputMap) {
            inputMap[key] = false;
        }
    });

    let enemySpawnTimer = 0;
    const arrows = [];
    
    // Pickups system
    const pickups = [];
    let wingSpawnTimer = 4000; // Start at 4000 so it spawns almost immediately (at 5000)
    
    const spawnWings = () => {
        const wingPickupMat = new BABYLON.StandardMaterial("wingPickupMat", scene);
        wingPickupMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
        wingPickupMat.emissiveColor = new BABYLON.Color3(0.5, 0.5, 0.5); // Make it glow a bit so it's obvious
        
        // Invisible collision box for the pickup
        const wingPickup = BABYLON.MeshBuilder.CreateBox("wingPickup", { width: 2, height: 2, depth: 1 }, scene);
        wingPickup.visibility = 0; // invisible
        
        // Add actual visual wings to the pickup
        const leftPickupWing = BABYLON.MeshBuilder.CreateCylinder("pw_left", { diameterTop: 0.8, diameterBottom: 0.1, height: 2, tessellation: 16 }, scene);
        leftPickupWing.parent = wingPickup;
        leftPickupWing.position = new BABYLON.Vector3(-0.6, 0, 0);
        leftPickupWing.rotation.z = Math.PI / 6;
        leftPickupWing.scaling.z = 0.1;
        leftPickupWing.material = wingPickupMat;
        
        const rightPickupWing = BABYLON.MeshBuilder.CreateCylinder("pw_right", { diameterTop: 0.8, diameterBottom: 0.1, height: 2, tessellation: 16 }, scene);
        rightPickupWing.parent = wingPickup;
        rightPickupWing.position = new BABYLON.Vector3(0.6, 0, 0);
        rightPickupWing.rotation.z = -Math.PI / 6;
        rightPickupWing.scaling.z = 0.1;
        rightPickupWing.material = wingPickupMat;
        
        // Spawn it close to the center so it's easy to find
        const angle = Math.random() * Math.PI * 2;
        const radius = 5 + Math.random() * 5; // 5 to 10 units away
        wingPickup.position = new BABYLON.Vector3(Math.cos(angle) * radius, 1, Math.sin(angle) * radius);
        pickups.push({ type: "wings", mesh: wingPickup });
    };

    // Game loop
    scene.onBeforeRenderObservable.add(() => {
        player.update(inputMap, engine, enemies, arrows);
        
        // Update pickups
        for (let i = pickups.length - 1; i >= 0; i--) {
            const pickup = pickups[i];
            pickup.mesh.rotation.y += 0.05; // Spin effect
            let pickedUp = false;
            
            if (player.mesh.intersectsMesh(pickup.mesh, false)) {
                if (pickup.type === "wings") {
                    player.hasWings = true;
                    // Make wings visible
                    player.mesh.getChildMeshes().forEach(m => {
                        if (m.name.startsWith("wings")) m.isVisible = true;
                    });
                }
                pickedUp = true;
            } else {
                for (const enemy of enemies) {
                    if (!enemy.isDead && !enemy.hasWings && enemy.mesh.intersectsMesh(pickup.mesh, false)) {
                        if (pickup.type === "wings") {
                            enemy.hasWings = true;
                            enemy.mesh.getChildMeshes().forEach(m => {
                                if (m.name.startsWith("e_wings")) m.isVisible = true;
                            });
                        }
                        pickedUp = true;
                        break;
                    }
                }
            }

            if (pickedUp) {
                pickup.mesh.dispose();
                pickups.splice(i, 1);
            }
        }

        // Spawn wings if they don't have them
        if (!player.hasWings && pickups.length === 0) {
            wingSpawnTimer += engine.getDeltaTime();
            if (wingSpawnTimer > 5000) { // Every 5 seconds it will spawn if you lost it
                wingSpawnTimer = 0;
                spawnWings();
            }
        }

        // Update arrows and check arrow collisions
        for (let i = arrows.length - 1; i >= 0; i--) {
            const arrow = arrows[i];
            arrow.update(engine);
            
            if (arrow.isEnemyArrow) {
                if (!player.invulnerableTimer && arrow.mesh.intersectsMesh(player.mesh, false)) {
                    player.takeDamage(2);
                    arrow.isDead = true;
                    arrow.mesh.dispose();
                }
            } else {
                for (const enemy of enemies) {
                    if (!enemy.isDead && arrow.mesh.intersectsMesh(enemy.mesh, false)) {
                        enemy.takeDamage(2);
                        arrow.isDead = true;
                        arrow.mesh.dispose();
                        break;
                    }
                }
            }

            if (arrow.isDead) {
                arrows.splice(i, 1);
            }
        }

        // Clean up dead enemies
        for (let i = enemies.length - 1; i >= 0; i--) {
            if (enemies[i].isDead) {
                enemies.splice(i, 1);
            } else {
                enemies[i].update(engine, player, arrows);
            }
        }

        // Check level completion
        if (enemies.length === 0) {
            currentLevel++;
            generateLevel();
            // Reset player position for the new level
            player.mesh.position = new BABYLON.Vector3(0, 5, 0);
            player.yVelocity = 0;
            
            // Clean up existing arrows
            for (let arrow of arrows) {
                if (arrow.mesh) arrow.mesh.dispose();
            }
            arrows.length = 0;
            
            // Optional: reset health or wings if desired.
        }
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
