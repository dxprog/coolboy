import RomLoader from './rom-loader';

let romLoader = new RomLoader();
romLoader.load('tetris').then(() => {
  console.log('loaded successfully');
});