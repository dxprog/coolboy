const Cpu = function(rom, ppu) {
  // Pointers to other parts of the machine
  this._rom = rom;
  this._ppu = ppu;
  
  // Reset the CPU's internal state
  this.reset();
};

Cpu.prototype = {
  reset() {
    this._sp = 0;
    this._pc = 0;
    this._a = 0;
    this._b = 0;
    this._hl = 0;
  },
  
  begin() {
    this.reset();
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
    console.log('read: ', addr.toString(16), retVal.toString(16));
    return retVal;
  },
  
  _writeMem(addr, value) {
    console.log('write: ', addr.toString(16), value.toString(16));
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
  
  _setFlags(value) {
    
  },
  
  // NOP
  op0() {
    this._cycles += 4;
  },
  
  /**
   * JP
   */
  _jp(addr) {
    this._pc = addr;
    this._cycles += 10;
  },
  
  // JP xx
  opc3() {
    this._jp(this._readOp16());
  },
  
  /**
   * XOR
   */
  _xor(value) {
    this._a = this._a ^ value;
    this._cycles += 4;
    this._setFlags(this._a);
  },
  
  opaf() {
    this._xor(this._a);
  },
  
  /**
   * LD
   */
  _ldReg8(reg, value) {
    this[reg] = value;
    this._cycles += 7;
    this._setFlags(value);
  },
  
  // LD lh,xx
  op21() {
    this._hl = this._readOp16();
    this._cycles += 10;
  },
  
  // LD c,x
  ope() {
    this._ldReg8('_c', this._readOp());
  },
  
  // LD b,x
  op6() {
    this._ldReg8('_b', this._readOp());
  },
  
  // LD (HLD),a
  // This is custom to the GameBoy. Writes A into (HL) and then decrements HL
  op32() {
    this._writeMem(this._hl, this._a);
    this._cycles += 13;
    this.op2b(); // DEC hl
  },
  
  /**
   * DEC
   */
  _decReg8(reg) {
    this[reg] = (this[reg] - 1) & 0xff;
    this._cycles += 4;
    this._setFlags(this[reg]);
  },
  
  _decReg16(reg) {
    this[reg] = (this[reg] - 1) & 0xffff;
    this._cycles += 6;
  },
  
  op5() {
    this._decReg8('_b');
  },
  
  op2b() {
    this._decReg16('_hl');
  }

};

export default Cpu;