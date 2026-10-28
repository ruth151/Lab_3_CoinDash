/* global Phaser, COIN_DASH, SFX */
// Best score persists via localStorage when possible, otherwise only for this session.
const HighScore = {
  session: 0,
  persistent: true,
  load() {
    let stored = 0;
    try {
      const raw = window.localStorage.getItem(COIN_DASH.highScoreKey);
      const n = Number(raw);
      if (raw !== null && /^\d+$/.test(raw) && Number.isSafeInteger(n)) stored = n;
      this.persistent = true;
    } catch (e) { this.persistent = false; }
    this.session = Math.max(this.session, stored);
    return this.session;
  },
  save(score) {
    this.session = Math.max(this.session, score);
    try {
      window.localStorage.setItem(COIN_DASH.highScoreKey, String(this.session));
      this.persistent = true;
    } catch (e) { this.persistent = false; }
  }
};

class CoinDash extends Phaser.Scene {
  constructor() { super('CoinDash'); }

  create() {
    const c = COIN_DASH;
    this.score = 0;
    this.finished = false;
    this.paused = false;
    this.best = HighScore.load();
    this.deadline = this.time.now + c.roundSeconds * 1000;
    this.physics.world.setBounds(0, 44, c.width, c.height - 44);
    this.panel = null;
    this.grid = this.add.grid(c.width / 2, c.height / 2, c.width, c.height, 40, 40,
      c.colors.background, 1, c.colors.grid, 0.45);
    const hudStyle = { font: '18px monospace', color: c.colors.text };
    this.hud = this.add.text(18, 12, '', hudStyle);
    this.bestText = this.add.text(c.width / 2, 12, '', hudStyle).setOrigin(0.5, 0);
    this.timeText = this.add.text(c.width - 18, 12, '', hudStyle).setOrigin(1, 0);
    this.showBest();
    this.player = this.add.rectangle(c.width / 2, c.height / 2, 24, 24, c.colors.player);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);
    this.coin = this.add.circle(100, 100, 9, c.colors.coin);
    this.physics.add.existing(this.coin);
    this.coin.body.setCircle(9);
    this.placeCoin();
    this.drones = this.physics.add.group();
    for (let i = 0; i < c.droneCount; i++) {
      const drone = this.add.rectangle(90 + i * 270, 100, 26, 26, c.colors.drone);
      this.drones.add(drone);
      drone.body.setCollideWorldBounds(true).setBounce(1, 1);
      const angle = (35 + i * 105) * Math.PI / 180;
      drone.body.setVelocity(Math.cos(angle) * c.droneSpeed, Math.sin(angle) * c.droneSpeed);
    }
    // One extra drone that steers towards the player instead of bouncing.
    this.chaser = this.add.rectangle(c.width - 60, c.height - 60, 26, 26, c.colors.chaser);
    this.drones.add(this.chaser);
    this.chaser.body.setCollideWorldBounds(true);
    this.physics.add.overlap(this.player, this.coin, () => {
      if (this.finished) return;
      this.score++;
      SFX.coin();
      this.placeCoin();
    });
    this.physics.add.overlap(this.player, this.drones, () => {
      if (this.finished) return;
      SFX.hit();
      this.finish('A drone caught you!');
    });
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R');
    this.input.keyboard.on('keydown-R', () => this.scene.restart());
    this.input.keyboard.on('keydown-P', (event) => { if (!event.repeat) this.togglePause(); });
    this.pauseOverlay = this.add.container(c.width / 2, c.height / 2, [
      this.add.rectangle(0, 0, 360, 110, c.colors.pauseOverlay, 0.9),
      this.add.text(0, 0, 'PAUSED\nP to resume · R to restart',
        { font: '22px monospace', color: '#ffffff', align: 'center', lineSpacing: 12 }).setOrigin(0.5)
    ]).setDepth(10).setVisible(false);
    // The registry outlives scene restarts, so the chosen mode stays after R.
    this.input.keyboard.on('keydown-N', () => this.setTheme('dark'));
    this.input.keyboard.on('keydown-L', () => this.setTheme('light'));
    this.applyTheme();
  }

  togglePause() {
    if (this.finished) return;
    this.paused = !this.paused;
    this.pauseOverlay.setVisible(this.paused);
    if (this.paused) {
      this.pausedAt = this.time.now;
      this.physics.pause();
    } else {
      // Push the deadline back so time spent paused does not count against the round.
      this.deadline += this.time.now - this.pausedAt;
      this.physics.resume();
    }
  }

  themeColors() {
    return this.registry.get('theme') === 'light' ? COIN_DASH.lightColors : COIN_DASH.colors;
  }

  setTheme(name) {
    this.registry.set('theme', name);
    this.applyTheme();
  }

  applyTheme() {
    const colors = this.themeColors();
    this.cameras.main.setBackgroundColor(colors.background);
    this.grid.setFillStyle(colors.background, 1).setOutlineStyle(colors.grid, 0.45);
    [this.hud, this.bestText, this.timeText].forEach(text => text.setColor(colors.text));
    this.player.setFillStyle(colors.player);
    this.coin.setFillStyle(colors.coin);
    this.drones.getChildren().forEach(drone =>
      drone.setFillStyle(drone === this.chaser ? colors.chaser : colors.drone));
    if (this.panel) {
      this.panel.setFillStyle(colors.panel, 0.95);
      this.message.setColor(colors.text);
    }
    document.body.classList.toggle('light', colors === COIN_DASH.lightColors);
  }

  placeCoin() {
    const c = COIN_DASH;
    // Avoid spawning the next coin directly underneath the player.
    let x, y;
    do {
      x = Phaser.Math.Between(25, c.width - 25);
      y = Phaser.Math.Between(70, c.height - 25);
    } while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 60);
    this.coin.setPosition(x, y);
    this.coin.body.reset(x, y);
  }

  update() {
    if (this.finished || this.paused) return;
    const dx = Number(this.cursors.right.isDown || this.keys.D.isDown)
      - Number(this.cursors.left.isDown || this.keys.A.isDown);
    const dy = Number(this.cursors.down.isDown || this.keys.S.isDown)
      - Number(this.cursors.up.isDown || this.keys.W.isDown);
    const direction = new Phaser.Math.Vector2(dx, dy).normalize().scale(COIN_DASH.playerSpeed);
    this.player.body.setVelocity(direction.x, direction.y);
    this.physics.moveToObject(this.chaser, this.player, COIN_DASH.chaserSpeed);
    const seconds = Math.max(0, Math.ceil((this.deadline - this.time.now) / 1000));
    this.hud.setText(`Coins: ${this.score}`);
    this.timeText.setText(`Time: ${seconds}s`);
    if (seconds === 0) this.finish('Time is up!');
  }

  showBest() {
    this.bestText.setText(`Best: ${this.best}${HighScore.persistent ? '' : ' (not saved)'}`);
  }

  finish(reason) {
    if (this.finished) return;
    this.finished = true;
    this.physics.pause();
    const c = COIN_DASH;
    const record = this.score > this.best;
    if (record) {
      HighScore.save(this.score);
      this.best = this.score;
      this.showBest();
    }
    const note = HighScore.persistent ? '' : ' (not saved)';
    const bestLine = record ? `New high score!${note}` : `Best: ${this.best}`;
    const colors = this.themeColors();
    this.panel = this.add.rectangle(c.width / 2, c.height / 2, 460, 190, colors.panel, 0.95);
    this.message = this.add.text(c.width / 2, c.height / 2,
      `${reason}\n${this.score} coins collected\n${bestLine}\nPress R to try again`,
      { font: '24px monospace', color: colors.text, align: 'center', lineSpacing: 12 }
    ).setOrigin(0.5);
  }
}
window.coinDashGame = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: COIN_DASH.width,
  height: COIN_DASH.height,
  backgroundColor: COIN_DASH.colors.background,
  physics: { default: 'arcade', arcade: { debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
  scene: CoinDash
});
