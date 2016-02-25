const REG_A = '_a';
const REG_B = '_b';
const REG_C = '_c';
const REG_D = '_d';
const REG_E = '_e';
const REG_H = '_h';
const REG_L = '_l';
const REG_F = '_f';
const FLAG_C = 0x10;
const FLAG_H = 0x20;
const FLAG_N = 0x40;
const FLAG_Z = 0x80;

const WORD_CLAMP = 0xffff;
const BYTE_CLAMP = 0xff;
const WORK_RAM_SIZE = 0x4000;
const WORK_RAM_START = 0xc000;
const SP_START = 0xfffe;

const Cpu = function(rom, ppu) {
  // Pointers to other parts of the machine
  this._rom = rom;
  this._ppu = ppu;

  // Initialize work RAM here. A CPU reset will _NOT_ clear its contents
  this._wram = new Uint8Array(WORK_RAM_SIZE);
  this._wram.forEach((value, index) => this._wram[index] = 0);

  // Reset the CPU's internal state
  this.reset();
};

Cpu.prototype = {
  reset() {
    this._sp = SP_START; // Stack pointer
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
    if (this._cycles <= 0) {
      this._currentAddr = this._pc.toString(16);
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

  _log(text) {
    const addr = '0'.repeat(4 - this._currentAddr.length) + this._currentAddr;
    console.log(`${addr}: ${text}`);
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
    // console.log('read: ', addr.toString(16), retVal.toString(16));
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
  },

  /**
   * Sets an individual flag
   */
  _setFlag(flag, high) {
    this[REG_F] = high ? this[REG_F] |= flag : this[REG_F] &= ~flag;
    // console.log('reg: ', flag.toString(16), high, this._f);
  },

  /**
   * Returns a flag's status as a boolean
   */
  _getFlag(flag) {
    return !!(this._f & flag);
  },

  // NOP
  op0() {
    this._log('nop');
    this._cycles += 4;
  },

  // Normally this would be: EX (sp),hl
  // But not for Nintendo...
  ope3() {
    this.op0();
  },

  /**
   * JP
   */
  _jp(addr) {
    this._log(`jp ${addr.toString(16)}`);
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
    this._log(`xor 0x${value.toString(16)}`);
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

  // Loads a value into a register
  _ldReg8(reg, value) {
    this._log(`ld ${reg}, 0x${value.toString(16)}`);
    this[reg] = value;
    this._cycles += 4;
    this._setFlags(value);
  },

  // Loads the value of one register into another
  _ldRegWithReg(regTo, regFrom) {
    this._log(`ld ${regTo}, ${regFrom}`);
    this[regTo] = this[regFrom];
    this._cycles += 4;
  },

  // Loads the value of the accumulator into the memory address
  // of a 16-bit register combo
  _ldIndirectA(reg1, reg2) {
    this._log(`ld (${reg1}${reg2}), a`);
    const addr = (this[reg1] << 0x8) | this[reg2];
    this._writeMem(addr, this[REG_A]);
    this._cycles += 8;
  },

  // LD hl,xx
  op21() {
    this[REG_L] = this._readOp();
    this[REG_H] = this._readOp();
    this._log(`ld hl, 0x${((this[REG_H] << 8) | this[REG_L]).toString(16)}`);
    this._cycles += 10;
  },

  // LD a, a
  op7f() {
    this._ldRegWithReg(REG_A, REG_A);
  },

  // LD b, a
  op47() {
    this._ldRegWithReg(REG_B, REG_A);
  },

  // LD c, a
  op4f() {
    this._ldRegWithReg(REG_C, REG_A);
  },

  // LD d, a
  op57() {
    this._ldRegWithReg(REG_D, REG_A);
  },

  // LD e, a
  op5f() {
    this._ldRegWithReg(REG_E, REG_A);
  },

  // LD h, a
  op67() {
    this._ldRegWithReg(REG_H, REG_A);
  },

  // LD l, a
  op6f() {
    this._ldRegWithReg(REG_L, REG_A);
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

  // LD a, (xx)
  opfa() {
    this._ldReg8(REG_A, this._readMem(this._readOp16()));
  },

  // LD (bc), a
  op2() {
    this._ldIndirectA(REG_B, REG_C);
  },

  // LD (de), a
  op12() {
    this._ldIndirectA(REG_D, REG_E);
  },

  // LD (hl), a
  op77() {
    this._ldIndirectA(REG_H, REG_L);
  },

  // LD (HLD),a
  // This is custom to the GameBoy. Writes A into (HL) and then decrements HL
  op32() {
    this._log('ld (hld), a');
    const addr = (this[REG_H] << 0x8) | this[REG_L];
    this._writeMem(addr, this[REG_A]);
    this._cycles += 13;
    this.op2b(); // DEC hl
  },

  // LD (x), a
  ope0() {
    const addr = this._readOp();
    this._log(`ld (${addr.toString(16)}), a`);
    this._writeMem(0xff00 | addr, this[REG_A]);
    this._cycles += 11;
  },

  // LD a, (x)
  opf0() {
    const addr = this._readOp();
    this._log(`ld a, (${addr.toString(16)})`);
    this[REG_A] = this._readMem(0xff00 | addr);
    this._cycles += 11;
  },

  /**
   * DEC
   */
  _decReg8(reg) {
    this._log(`dec ${reg}`);
    this[reg] = (this[reg] - 1) & BYTE_CLAMP;
    this._cycles += 4;
    this._setFlags(this[reg]);
    this._setFlag(FLAG_N, true);
  },

  // Helper function because fake 16-bit registers are dumb
  _decReg16(reg1, reg2) {
    this._log(`dec ${reg1}${reg2}`);
    let value = (this[reg1] << 0x8) | this[reg2];
    value = (value - 1) & WORD_CLAMP;
    this[reg1] = value >> 0x8;
    this[reg2] = value & BYTE_CLAMP;
    this._cycles += 6;
    this._setFlag(FLAG_N, true);
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
      const offset = !!(addr & 0x80) ? -((~addr & BYTE_CLAMP) + 1) : addr & 0x7f;
      this._pc = (this._pc + offset) & 0xffff;
      this._cycles += 5;
    }
    this._cycles += 7;
  },

  // JR NZ,x
  op20() {
    const op = this._readOp();
    this._log(`jr nz, 0x${op.toString(16)}`);
    this._jr(!this._getFlag(FLAG_Z), op);
  },

  /**
   * Interrupts
   */
  opf3() {
    this._log('disable interrupts');
    this._di = true;
    this.op0();
  },

  opfb() {
    this._log('enable interrupts');
    this._di = false;
  },

  /**
   * PUSH
   */
  _push(value) {
    this._writeMem(this._sp--, value & BYTE_CLAMP);
    this._writeMem(this._sp--, value >> 0x8);
    this._cycles += 11;
  },

  /**
   * POP
   */
  _pop() {
    const msb = this._readMem(++this._sp);
    const addr = (msb << 0x8) | this._readMem(++this._sp);
    this._log('pop', addr.toString(16));
    return addr;
  },

  /**
   * CALL
   */
  _call(addr) {
    this._log(`call 0x${addr.toString(16)}`);
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

  // RET nz
  opc0() {
    this._log('ret nz');
    this._ret(!this._getFlag(FLAG_Z));
  },

  opc8() {
    this._log('ret z');
    this._ret(!!this._getFlag(FLAG_Z));
  },

  /**
   * CP
   */

  // CP x
  opfe() {
    const op = this._readOp();
    this._log(`cp 0x${op.toString(16)}`);
    const value = this[REG_A] - op;
    this._setFlags(value);
    this._cycles += 7;
  },

  /**
   * AND
   */
  _and(value) {
    this._log(`and ${value.toString(16)}`);
    this[REG_A] &= value;
    this._setFlags(this[REG_A]);
    this._setFlag(FLAG_N, false);
    this._setFlag(FLAG_H, true);
    this._setFlag(FLAG_C, false);
    this._cycles += 4;
  },

  opa7() {
    this._and(this[REG_A]);
  }

};

export default Cpu;