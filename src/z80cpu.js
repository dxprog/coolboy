const REG_A = '_a';
const REG_B = '_b';
const REG_C = '_c';
const REG_D = '_d';
const REG_E = '_e';
const REG_H = '_h';
const REG_L = '_l';
const REG_F = '_f';
const FLAG_Z = 0x40;
const FLAG_S = 0x80;

const WORD_CLAMP = 0xffff;
const BYTE_CLAMP = 0xff;
const WORK_RAM_SIZE = 0x3fff;
const WORK_RAM_START = 0xc000;

const Cpu = function(rom, ppu) {
  // Pointers to other parts of the machine
  this._rom = rom;
  this._ppu = ppu;
  this._wram = new Uint8Array(WORK_RAM_SIZE);
  
  // Reset the CPU's internal state
  this.reset();
};

Cpu.prototype = {
  reset() {
    this._sp = 0; // Stack pointer
    this._pc = 0; // Program counter
    this[REG_A] = 0; // Accumulator
    this[REG_B] = 0; // B
    this[REG_C] = 0; // C
    this[REG_D] = 0; // D
    this[REG_E] = 0; // E
    this[REG_H] = 0; // H
    this[REG_L] = 0; // L
    this[REG_F] = 0; // Status flags
    this._di = false; // Disable interrupt
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
   * @private
   * @param {Uint16} addr The address to read
   * @return {Uint8} The value at the address
   */
  _readMem(addr) {
    let retVal = 0;
    
    // Memory map:
    // ROM (0x0000 - 0x7fff)
    addr &= WORD_CLAMP;
    if (addr < 0x8000) {
      retVal = this._rom.readUint8(addr);
      
    // WRAM (0xc000 - 0xffff)
    } else if (addr >= WORK_RAM_START) {
      retVal = this._wram[addr - WORK_RAM_START];

    } else {
      throw `Memory address space unimplemented: ${addr.toString(16)}`;
    }
    console.log('read: ', addr.toString(16), retVal.toString(16));
    return retVal;
  },
  
  /**
   * Writes a value to a memory mapped address
   * 
   * @method _writeMem
   * @private
   * @param {Uint16} add The address to write to
   * @param {Uint8} value The value to write
   * @return {Void}
   */
  _writeMem(addr, value) {
    value &= BYTE_CLAMP;
    addr &= WORD_CLAMP;
    if (addr >= WORK_RAM_START) {
      this._wram[addr - WORK_RAM_START] = value;
    }
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
    this[REG_A] = this[REG_A] ^ value;
    this._cycles += 4;
    this._setFlags(this[REG_A]);
  },
  
  opaf() {
    this._xor(this[REG_A]);
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
    this[REG_L] = this._readOp();
    this[REG_H] = this._readOp();
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
    const addr = (this[REG_H] << 0x8) | this[REG_L];
    this._writeMem(addr, this[REG_A]);
    this._cycles += 13;
    this.op2b(); // DEC hl
  },
  
  /**
   * DEC
   */
  _decReg8(reg) {
    this[reg] = (this[reg] - 1) & BYTE_CLAMP;
    this._cycles += 4;
    this._setFlags(this[reg]);
  },
  
  // Helper function because fake 16-bit registers are dumb
  _decReg16(reg1, reg2) {
    let value = (this[reg1] << 0x8) | this[reg2];
    value = (value - 1) & WORD_CLAMP;
    this[reg1] = value >> 0x8;
    this[reg2] = value & BYTE_CLAMP;
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
    this._decReg16(REG_H, REG_L);
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
    this.op0();
  },
  
  opfb() {
    this._di = false;
  },
  
  /**
   * PUSH
   */  
  _push(value) {
    this._writeMem(this._sp++, value & BYTE_CLAMP);
    this._writeMem(this._sp++, value >> 8);
    this._cycles += 11;
  },
  
  /**
   * POP
   */
  _pop() {
    const msb = this._readMem(this._sp--);
    return (msb << 0x8) | this._readMem(this._sp--);
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