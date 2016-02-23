const Cpu = function(rom, ppu) {
  // Pointers to other parts of the machine
  this._rom = rom;
  this._ppu = ppu;
  
  // Registers
  this._sp = 0;
  this._pc = 0;
};

Cpu.prototype = {
  begin() {
    this._sp = 0;
    this._pc = this._rom.getStartVector();
    
    // Cycles is the number of cycles required to perform a particular operation
    this._cycles = 0;
  },
  
  tick() {
    if (this._cycles) {
      const opCode = this._readOp().toString(16);
      // This check can be thrown away once implementation is complete
      if (this[`op${opCode}`]) {
        this[`op${opCode}`]();
      } else {
        throw `Unimplemented opcode: ${opCode}`;
      }
    } else {
      this._cycles--;
    }
  },
  
  /**
   * Reads value from memory mapped address
   * 
   * @method _readMem
   * @param {Uint16} addr The address to read
   * @return {Uint8} The value at the address
   */
  _readMem(addr) {
    let retVal = 0;
    
    // Memory map:
    // ROM
    addr &= 0xffff;
    if (addr < 0x8000) {
      retVal = this._rom.readUint8(addr);
    } else {
      throw `Memory address space unimplemented: ${addr.toString(16)}`;
    }
    console.log(addr.toString(16), retVal.toString(16));
    return retVal;
  },
  
  // 16-bit PC read
  _readOp16(addr) {
    const lsb = this._readOp();
    return (this._readOp() << 0x8) | lsb;
  },
  
  // 8-bit PC read
  _readOp() {
    this._cycles++;
    return this._readMem(this._pc++);
  },
  
  /****************************************
   *                OP CODES              *
   ***************************************/
  
  // NOP
  op0() {
    this._cycles += 4;
  },
  
  // JP xx
  opc3() {
    this._pc = this._readOp16();
    this._cycles += 10;
  }

};

export default Cpu;