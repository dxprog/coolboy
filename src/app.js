import RomLoader from './rom-loader';
import Z80 from './z80cpu';

const romLoader = new RomLoader();
romLoader.load('tetris').then(() => {
  const cpu = new Z80(romLoader, null);
  let ticks = 1000;
  cpu.begin();
  while (true) {
    cpu.tick();
    if (ticks) {
      ticks--;
    } else {
      break;
    }
  }
});