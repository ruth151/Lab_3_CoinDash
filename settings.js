// Keep tuning separate from game behaviour so features can be developed independently.
window.COIN_DASH = {
  width: 800,
  height: 500,
  roundSeconds: 45,
  playerSpeed: 240,
  droneSpeed: 105,
  droneCount: 3,
  // Dark mode (default look). Press N for dark, L for light.
  colors: {
    background: 0x101c31, grid: 0x24334b, player: 0x71e8ce, coin: 0xffd166, drone: 0xff657a,
    text: '#ffffff', panel: 0x0a1120
  },
  lightColors: {
    background: 0xeef2f7, grid: 0xa9b6c9, player: 0x0f9d84, coin: 0xe0a100, drone: 0xe0314b,
    text: '#132036', panel: 0xffffff
  }
};
