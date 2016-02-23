const REG_A = '_a';
const REG_B = '_b';
const REG_C = '_c';
const REG_HL = '_hl';
const FLAG_Z = 0x40;
const FLAG_S = 0x80;

const Cpu = function(rom, ppu) {
  // Pointers to other parts of the machine
  this._rom = rom;
  this._ppu = ppu;
  
  // Reset the CPU's internal state
  this.reset();
};

Cpu.prototype = {
  reset() {
    this._sp = 0; // Stack pointer
    this._pc = 0; // Program counter
    this._a = 0; // Accumulator
    this._b = 0; // B
    this._c = 0; // C
    this._hl = 0; // HL (16-bit reg)
    this._f = 0; // Status flags
    this._di = false; // Disable interrupt
    this._stack = [];
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
  
  /**
   * Given a value, sets the appropriate flag
   */
  _setFlags(value) {
    this._setFlag(FLAG_Z, value === 0);
    this._setFlag(FLAG_S, (value & 0x80) > 0);
  },
  
  /**
   * Sets an individual flag
   */
  _setFlag(flag, high) {
    if (high) {
      this._f |= flag;
    } else {
      this._f &= ~flag; 
    }
    console.log('reg: ', flag.toString(16), high, this._f);
  },
  
  /**
   * Returns a flag's status as a boolean
   */
  _getFlag(flag) {
    return !!(this._f & flag);
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
  
  // LD hl,xx
  op21() {
    this._hl = this._readOp16();
    this._cycles += 10;
  },
  
  // LD c,x
  ope() {
    this._ldReg8(REG_C, this._readOp());
  },
  
  // LD b,x
  op6() {
    this._ldReg8(REG_B, this._readOp());
  },
  
  // LD a,x
  op3e() {
    this._ldReg8(REG_A, this._readOp());
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
  
  // DEC b
  op5() {
    this._decReg8(REG_B);
  },
  
  // DEC c
  opd() {
    this._decReg8(REG_C);
  },
  
  // DEC hl
  op2b() {
    this._decReg16(REG_HL);
  },
  
  /**
   * JR (jump relative)
   */
  _jr(cond, addr) {
    if (cond) {
      // Calculate up the direction
      addr = !!(addr & 0x80) ? -(addr & 0x7f) : addr & 0x7f;
      this._pc = (this._pc + addr) & 0xffff;
      this._cycles += 5;
    }
    this._cycles += 7;
  },
  
  // JR NZ,x
  op20() {
    this._jr(!this._getFlag(FLAG_Z), this._readOp());
  },
  
  /**
   * Interrupts
   */
  opf3() {
    this._di = true;
    op0();
  },
  
  opfb() {
    this._di = false;
  },
  
  /**
   * PUSH
   */  
  _push(value) {
    this._stack.push(value & 0xff);
    this._stack.push(value >> 0x8);
    this._sp++;
    this._cycles += 11;
  },
  
  /**
   * POP
   */
  _pop() {
    const msb = this._stack.pop();
    return (msb << 0x8) | this._stack.pop();
  },
  
  /**
   * CALL
   */
  _call(addr) {
    this._push(this._pc);
    this._pc = addr;
    this._cycles += 6;
  },
  
  // CALL xx
  opcd() {
    this._call(this._readOp16());
  },
  
  /**
   * RET
   */
  _ret(cond) {
    if (cond) {
      this._pc = this._pop();
    }
  },
  
  // RET p
  opf0() {
    this._ret(!this._getFlag(FLAG_S));
  }

};

export default Cpu;