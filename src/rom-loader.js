const { fetch } = window;

const ROM_DIR = './roms/';
const ROM_EXT = 'gb';

// Header value memory offsets
const HEADER_POS = 0x100;
const HEADER_VAL = 0xc300;
const JUMP_VECTOR = 0x102;
const TITLE_START = 0x134;
const TITLE_END = 0x143; 
const ROM_TYPE = 0x147;
const ROM_SIZE = 0x148;
const CHECKSUM = 0x14e;

const Rom = function() {
  this._rom = null;
  this._loaded = false;
};

Rom.prototype = {
  
  /**
   * Loads a ROM file
   * 
   * @method load
   * @param {String} fileName Name of file to load
   * @return {Promise} Promise that's resolved after loading
   */
  load(fileName) {
    return fetch(`${ROM_DIR}${fileName}.${ROM_EXT}`).then((res) => res.arrayBuffer()).then(this.parseRom.bind(this));
  },
  
  parseRom(data) {
    this._size = data.size;
    this._rom = new Uint8Array(data);
    
    // Verify the header (should always be C300)
    if (this.readUint16(HEADER_POS) !== HEADER_VAL) {
      throw 'Invalid GB ROM';
    }
    
    // Currently, only ROM and 2 banks supported
    this._cartType = this._rom[ROM_TYPE];
    this._bankSize = this._rom[ROM_SIZE];
    if (this._cartType !== 0 || this._bankSize !== 0) {
      throw 'Only 256Kb ROMs are supported';
    }
    
    // Calculate the checksum by adding all bytes (except checksum) and using the last two bytes
    const hash = this._rom.reduce((prev, curr, index) => {
      return index !== CHECKSUM && index !== CHECKSUM + 1 ? prev + curr : prev;
    }) & 0xffff;
    // Checksum is stored big endian... why, I don't know
    const checksum = ((this._rom[CHECKSUM] << 0x8) | this._rom[CHECKSUM + 1]);
    if (checksum !== hash) {
      throw 'Invalid ROM checksum';
    }
    
    this._startVector = this.readUint16(JUMP_VECTOR);
    this._title = this._readTitle();
  },
  
  /**
   * Reads and returns a single byte at the passed address. Will roll over addresses larger than 16-bits
   */
  readUint8(addr) {
    this._verifyRom();
    
    // Clamp the address to 16-bits
    addr &= 0xffff;
    return this._rom[addr];
  },
  
  /**
   * Reads and returns a 16-bit number at the passed address. Will roll over addresses larger than 16-bits
   */
  readUint16(addr) {
    this._verifyRom();
    
    // Clamp the address to 16-bits
    addr &= 0xffff;
    const lsb = this._rom[addr];
    const msb = this._rom[addr + 1];
    return lsb | (msb << 0x8);
  },
  
  /**
   * Returns the start vector address
   */
  getStartVector() {
    this._verifyRom();
    return this._startVector;
  },
  
  /**
   * Throws an error if no ROM is loaded
   */
  _verifyRom() {
    if (!this._rom) {
      throw 'No ROM is loaded';
    }
  },
  
  _readTitle() {
    let retVal = '';
    let char = 0;
    for (let i = TITLE_START; i <= TITLE_END; i++) {
      char = this._rom[i];
      if (char !== 0) {
        retVal += String.fromCharCode(char);
      } else {
        break;
      }
    }
    return retVal;
  }
  
};

export default Rom;