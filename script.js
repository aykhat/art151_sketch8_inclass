//SKETCH 8 - REMIXED VERSION
//COMPLETED BY: [Your Name]
///DATE: 11/19/2026

nn.on("load", () => {

  // KAPLAY SETUP
  kaplay({
    // button setup
    buttons: {
      moveUp: {
        keyboard: ["up", "w"],
        gamepad: ["dpad-up"],
      },
      moveDown: {
        keyboard: ["down", "s"],
        gamepad: ["dpad-down"],
      },
      moveLeft: {
        keyboard: ["left", "a"],
        gamepad: ["dpad-left"],
      },
      moveRight: {
        keyboard: ["right", "d"],
        gamepad: ["dpad-right"],
      },
    },

    // background color & settings
    background: [18, 16, 36],
    crisp: true,
  });

  // GLOBAL VARIABLES
  const SPEED = 180;
  const JUMP_FORCE = 480;
  const DEADZONE = 0.15;

  let soundEffect;
  let isPlaying = false;
  let bgm;

  let gameScore = 0;

  let spawnSide = "right"; // Start spawning enemies safely on the right

  // Helper to draw standalone pixel sprites
  function makePixelSprite(grid, colors) {
    const c = document.createElement("canvas");
    c.width = grid[0].length * 4;
    c.height = grid.length * 4;
    const ctx = c.getContext("2d");
    grid.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (colors[ch]) {
          ctx.fillStyle = colors[ch];
          ctx.fillRect(x * 4, y * 4, 4, 4);
        }
      });
    });
    return c.toDataURL();
  }

  // SPRITES
  // player sprite
  const playerSheet = makePixelSprite(
    [
      "..BBBB....BBBB..",
      ".BBBBBB..BBBBBB.",
      ".BWWWWB..BWWWWB.",
      ".BWBWBB..BWBWBB.",
      ".BBBBBB..BBBBBB.",
      "..BBBB....BBBB..",
      ".BBBBBB..BBBBBB.",
      ".B.BB.B..B.BB.B.",
    ],
    { B: "#29adff", W: "#ffffff" }
  );

  loadSprite("playerRun", playerSheet, {
    sliceX: 2,
    anims: {
      run: { from: 0, to: 1, loop: true, speed: 8 },
    },
  });

  // idle sprite
  const idleSheet = makePixelSprite(
    [
      "..BBBB..",
      ".BBBBBB.",
      ".BWWWWB.",
      ".BWBWBB.",
      ".BBBBBB.",
      "..BBBB..",
      "..BBBB..",
      "..B..B..",
    ],
    { B: "#29adff", W: "#ffffff" }
  );

  loadSprite("playerIdle", idleSheet, {
    sliceX: 1,
    anims: {
      idle: { from: 0, to: 0 },
    },
  });

  // enemy sprite
  loadSprite(
    "enemySprite",
    makePixelSprite(
      [
        ".RRRRRR.",
        "RRRRRRRR",
        "RYYRRYYR",
        "RRRRRRRR",
        "RRWWWWWR",
        "RRRRRRRR",
        "R.R..R.R",
        "R......R",
      ],
      { R: "#ff004d", Y: "#ffec27", W: "#ffffff" }
    )
  );

  // collectible sprite
  loadSprite(
    "gemSprite",
    makePixelSprite(
      [
        "..YYYY..",
        ".YYYYYY.",
        "YYWYYYYY",
        "YYWYYYYY",
        "YYWYYYYY",
        "YYWYYYYY",
        ".YYYYYY.",
        "..YYYY..",
      ],
      { Y: "#ffec27", W: "#ffffff" }
    )
  );

  // AUDIO ASSETS
  function makeToneWav(freq, duration) {
    const sampleRate = 22050;
    const samples = Math.floor(sampleRate * duration);
    const buffer = new ArrayBuffer(44 + samples * 2);
    const view = new DataView(buffer);
    const writeStr = (off, s) => [...s].forEach((c, i) => view.setUint8(off + i, c.charCodeAt(0)));
    writeStr(0, "RIFF");
    view.setUint32(4, 36 + samples * 2, true);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, "data");
    view.setUint32(40, samples * 2, true);

    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      const env = Math.max(0, 1 - i / samples);
      const val = Math.sin(2 * Math.PI * freq * t) * 0.35 * env;
      view.setInt16(44 + i * 2, val * 32767, true);
    }
    const bytes = new Uint8Array(buffer);
    let bin = "";
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    return "data:audio/wav;base64," + btoa(bin);
  }

  loadSound("coinSfx", makeToneWav(880, 0.12));
  loadMusic("bgMusic", makeToneWav(220, 0.5));

  // HELPERS
  function playSoundEffect(name) {
    soundEffect = play(name, { volume: 0.4 });
  }

  function makePlatform(x, y, w, colorValue = rgb(95, 87, 79)) {
    add([
      rect(w, 20),
      pos(x, y),
      area(),
      body({ isStatic: true }),
      color(colorValue),
      outline(2, rgb(255, 255, 255)),
      "platform",
    ]);
  }

  function spawnCollectible() {
    add([
      sprite("gemSprite"),
      pos(rand(140, width() - 80), rand(120, height() - 120)),
      area(),
      anchor("center"),
      "collectible",
    ]);
  }

  // REMIX 1: Purple power-up placed low & close so it's easy to reach
  function spawnJumpPowerup() {
    add([
      rect(18, 18),
      pos(140, height() - 75),
      area(),
      anchor("center"),
      color(194, 100, 255),
      outline(2, rgb(255, 255, 255)),
      "jumpPowerup",
    ]);
  }

  function spawnEnemy() {
    const startX = spawnSide === "right" ? width() - 130 : width() / 2;
    const dir = spawnSide === "right" ? -1 : 1;
    spawnSide = spawnSide === "right" ? "center" : "right";

    const enemy = add([
      sprite("enemySprite"),
      pos(startX, height() - 120),
      area(),
      body(),
      anchor("center"),
      "enemy",
      { dir: dir },
    ]);

    // enemy patrol movement
    enemy.onUpdate(() => {
      enemy.move(enemy.dir * 85, 0);
      if (enemy.pos.x < 180) enemy.dir = 1;
      if (enemy.pos.x > width() - 40) enemy.dir = -1;
    });
  }

  function spawnEnemyWave() {
    wait(1.5, () => spawnEnemy());
    wait(3.0, () => spawnEnemy());
  }

  function handleMovement(player) {
    const currentSpeed = SPEED * player.speedMultiplier;
    const stick = getGamepadStick("left");
    if (stick && Math.abs(stick.x) > DEADZONE) {
      player.move(stick.x * currentSpeed, 0);
      player.flipX = stick.x < 0;
    }

    if (player.pos.x < 20) player.pos.x = 20;
    if (player.pos.x > width() - 20) player.pos.x = width() - 20;
  }

  // LVL 1 SCENE
  scene("level1", () => {
    setGravity(640);

    const scoreText = add([
      text("Score: " + gameScore, { size: 18 }),
      pos(20, 20),
      fixed(),
      z(10),
    ]);

    // REMIX 1: UI showing current max jumps
    const jumpText = add([
      text("Max Jumps: 2", { size: 18 }),
      pos(20, 44),
      color(194, 100, 255),
      fixed(),
      z(10),
    ]);

    const player = add([
      sprite("playerIdle"),
      pos(60, height() - 90),
      area(),
      body(),
      anchor("center"),
      color(255, 255, 255),
      "player",
      { jumpCount: 0, maxJumps: 2, speedMultiplier: 1 },
    ]);

    // LEVEL EXIT
    const levelExit = add([
      rect(36, 56),
      pos(width() - 60, height() - 68),
      area(),
      anchor("center"),
      color(0, 228, 54),
      outline(3, rgb(255, 255, 255)),
      "levelExit",
    ]);

    // PLATFORMS
    // floor platform
    makePlatform(0, height() - 40, width(), rgb(62, 137, 72));

    // random platforms
    for (let i = 0; i < 5; i++) {
      const px = 140 + i * 130;
      const py = height() - 120 - (i % 3) * 70;
      makePlatform(px, py, 100, rgb(95, 87, 79));
    }

    // COLLECTIBLES
    for (let i = 0; i < 5; i++) {
      spawnCollectible();
    }
    spawnJumpPowerup(); // REMIX 1: Spawn purple 5-jump power-up

    // collectible loop
    loop(5, () => {
      if (get("collectible").length < 6) spawnCollectible();
    });

    // ENEMIES
    spawnEnemyWave();

    // enemy loop
    loop(7, () => {
      if (get("enemy").length < 3) spawnEnemy();
    });

    // CONTROLS
    onButtonDown("moveRight", () => {
      player.move(SPEED * player.speedMultiplier, 0);
      player.flipX = false;
    });

    onButtonDown("moveLeft", () => {
      player.move(-SPEED * player.speedMultiplier, 0);
      player.flipX = true;
    });

    // REMIX 2: Multi-Jump (2 jumps by default, 5 jumps with purple power-up)
    onButtonPress("moveUp", () => {
      if (player.isGrounded()) player.jumpCount = 0;
      if (player.jumpCount < player.maxJumps) {
        player.jump(JUMP_FORCE);
        player.jumpCount++;
      }
    });

    onButtonDown("moveDown", () => {
      player.move(0, SPEED);
    });

    // REMIX 3: Hold SHIFT to dash faster and turn green
    onKeyDown("shift", () => {
      player.speedMultiplier = 1.8;
      player.color = rgb(255, 236, 39);
    });

    onKeyRelease("shift", () => {
      player.speedMultiplier = 1;
      player.color = rgb(255, 255, 255);
    });

    // CAMERA
    // camera follow
    player.onUpdate(() => {
      if (player.isGrounded()) player.jumpCount = 0;
      camPos(vec2(width() / 2, lerp(camPos().y, player.pos.y, 0.05)));
    });

    // JOYSTICK (ANALOG) MOVEMENT & WIN/LOSE CHECK
    onUpdate(() => {
      handleMovement(player);

      // win check
      if (gameScore >= 200) go("win");

      // lose check
      if (player.pos.y > height() + 100) go("lose");
    });

    // COLLISIONS
    player.onCollide("collectible", (item) => {
      destroy(item);
      gameScore += 10;
      scoreText.text = "Score: " + gameScore;
      playSoundEffect("coinSfx");
    });

    // REMIX 1 COLLISION: Purple power-up lets you jump 5 times
    player.onCollide("jumpPowerup", (powerup) => {
      destroy(powerup);
      player.maxJumps = 5;
      jumpText.text = "Max Jumps: 5";
      playSoundEffect("coinSfx");
    });

    player.onCollide("enemy", () => {
      go("lose");
    });

    // TRANSITION EFFECT
    const fade = add([
      rect(width(), height()),
      pos(0, 0),
      color(0, 0, 0),
      opacity(0),
      fixed(),
      z(50),
    ]);

    let transitioning = false;
    player.onCollide("levelExit", () => {
      if (transitioning) return;
      transitioning = true;
      tween(0, 1, 0.4, (val) => (fade.opacity = val), easings.linear).onEnd(() => {
        go("level2");
      });
    });
  });

  // LVL 2 SCENE
  scene("level2", () => {
    setGravity(640);

    const scoreText = add([
      text("Score: " + gameScore, { size: 18 }),
      pos(20, 20),
      fixed(),
      z(10),
    ]);

    // REMIX 1: UI showing current max jumps
    const jumpText = add([
      text("Max Jumps: 2", { size: 18 }),
      pos(20, 44),
      color(194, 100, 255),
      fixed(),
      z(10),
    ]);

    const player = add([
      sprite("playerIdle"),
      pos(60, height() - 90),
      area(),
      body(),
      anchor("center"),
      color(255, 255, 255),
      "player",
      { jumpCount: 0, maxJumps: 2, speedMultiplier: 1 },
    ]);

    const returnExit = add([
      rect(36, 56),
      pos(width() - 60, 110),
      area(),
      anchor("center"),
      color(41, 173, 255),
      outline(3, rgb(255, 255, 255)),
      "returnExit",
    ]);

    // PLATFORMS
    // floor platform
    makePlatform(0, height() - 40, width(), rgb(126, 37, 83));

    // random platforms
    for (let i = 0; i < 5; i++) {
      makePlatform(120 + i * 115, height() - 110 - i * 55, 100, rgb(171, 82, 54));
    }

    // ENEMIES
    spawnEnemyWave();

    // enemy loop
    loop(6, () => {
      if (get("enemy").length < 4) spawnEnemy();
    });

    // COLLECTIBLES
    for (let i = 0; i < 6; i++) {
      spawnCollectible();
    }
    spawnJumpPowerup(); // REMIX 1: Spawn purple 5-jump power-up

    // collectible loop
    loop(4, () => {
      if (get("collectible").length < 6) spawnCollectible();
    });

    // CONTROLS
    onButtonDown("moveRight", () => {
      player.move(SPEED * player.speedMultiplier, 0);
      player.flipX = false;
    });

    onButtonDown("moveLeft", () => {
      player.move(-SPEED * player.speedMultiplier, 0);
      player.flipX = true;
    });

    // REMIX 2: Multi-Jump
    onButtonPress("moveUp", () => {
      if (player.isGrounded()) player.jumpCount = 0;
      if (player.jumpCount < player.maxJumps) {
        player.jump(JUMP_FORCE);
        player.jumpCount++;
      }
    });

    onButtonDown("moveDown", () => {
      player.move(0, SPEED);
    });

    // REMIX 3: Shift dash boost
    onKeyDown("shift", () => {
      player.speedMultiplier = 1.8;
      player.color = rgb(255, 236, 39);
    });

    onKeyRelease("shift", () => {
      player.speedMultiplier = 1;
      player.color = rgb(255, 255, 255);
    });

    // COLLISIONS
    player.onCollide("collectible", (item) => {
      destroy(item);
      gameScore += 15;
      scoreText.text = "Score: " + gameScore;
      playSoundEffect("coinSfx");
    });

    // REMIX 1 COLLISION: Purple power-up lets you jump 5 times
    player.onCollide("jumpPowerup", (powerup) => {
      destroy(powerup);
      player.maxJumps = 5;
      jumpText.text = "Max Jumps: 5";
      playSoundEffect("coinSfx");
    });

    player.onCollide("enemy", () => {
      go("lose");
    });

    // CAMERA
    // camera scale
    camScale(vec2(1.05));
    // camera follow
    player.onUpdate(() => {
      if (player.isGrounded()) player.jumpCount = 0;
      camPos(vec2(width() / 2, lerp(camPos().y, player.pos.y, 0.08)));
    });

    // ANALOG MOVEMENT & WIN/LOSE CHECK
    onUpdate(() => {
      handleMovement(player);

      // win check
      if (gameScore >= 250) go("win");

      // lose check
      if (player.pos.y > height() + 100) go("lose");
    });

    player.onCollide("returnExit", () => go("win"));
  });

  // WIN GAME SCENE
  scene("win", () => {
    add([
      text("YOU WIN!\nFinal Score: " + gameScore, { size: 36, align: "center" }),
      pos(width() / 2, height() / 2 - 40),
      anchor("center"),
      color(0, 228, 54),
    ]);

    add([
      text("Press ENTER to Play Again", { size: 20 }),
      pos(width() / 2, height() / 2 + 50),
      anchor("center"),
    ]);

    onKeyPress("enter", () => {
      gameScore = 0;
      spawnSide = "right";
      go("level1");
    });
  });

  // LOSE GAME SCENE
  scene("lose", () => {
    add([
      text("GAME OVER\nScore: " + gameScore, { size: 36, align: "center" }),
      pos(width() / 2, height() / 2 - 40),
      anchor("center"),
      color(255, 0, 77),
    ]);

    add([
      text("Press ENTER to Try Again", { size: 20 }),
      pos(width() / 2, height() / 2 + 50),
      anchor("center"),
    ]);

    onKeyPress("enter", () => {
      gameScore = 0;
      spawnSide = "right";
      go("level1");
    });
  });

  // START MUSIC ONCE LOADED
  onLoad(() => {
    bgm = play("bgMusic", { loop: true, volume: 0.2 });
    isPlaying = true;
  });

  onKeyPress("space", () => {
    if (!bgm) return;
    bgm.paused = isPlaying;
    isPlaying = !isPlaying;
  });

  // RESET GAME
  go("level1");
});