# Function Prologues

**Definition**: In assembly language programming, the **function prologue** is a few lines of code at the beginning of a function, which prepare the stack and registers for use within the function [1].

We will explore function prologues with respect to different ISAs and different compilers in this post. To illustrate, a simple C program and its corresponding assembly code under different settings are presented.

Consider the following C code:

```c
int add_one(int a) {
    return a + 1;
}

int add_two(int a) {
    return add_one(a+1);
}

int main() {
    int b = add_two(1);
    return 0;
}
```

The assembly code for `add_two` given by `x86-64 clang 17.0.1` is (We start by `add_two` because the assembly code for it is more clear and general):

```assembly
add_two:                                # @add_two
        pushq   %rbp
        movq    %rsp, %rbp
        subq    $16, %rsp
        movl    %edi, -4(%rbp)
        movl    -4(%rbp), %edi
        addl    $1, %edi
        callq   add_one
        addq    $16, %rsp
        popq    %rbp
        retq
```

The function prologue for `add_two` can be extracted as:

```assembly
add_two:                                # @add_two
        pushq   %rbp
        movq    %rsp, %rbp
        subq    $16, %rsp
        movl    %edi, -4(%rbp)
```

Let's explain this function prologue line by line.

First, we execute `pushq %rbp` to save the current base pointer `%rbp` on the stack. This is crucial because `%rbp` is used as the stack-frame base pointer in the x86-64 calling convention, providing a stable reference point within the stack frame for the current procedure [2]. By saving `%rbp`, we preserve the calling procedure's (`main`) stack frame context, as `%rbp` will now be repurposed for the `add_two` procedure.

Next, `movq %rsp, %rbp` updates `%rbp` to the current stack pointer `%rsp`, effectively setting the new base pointer for the `add_two` stack frame. At this point, the stack frame of `add_two` includes two key elements:

- `8(%rbp)` represents the return address. The `callq` instruction in `main` pushes the next instruction's address onto the stack before jumping to `add_two`. Hence, `%rsp` points to this return address **upon entering `add_two`**.

- `0(%rbp)` is the original `%rbp` value, saved earlier. With the first two lines of the prologue, the stack now includes the return address and the previous `%rbp`, and the `%rsp` and the new `%rbp` points precisely to this saved original `%rbp` on the stack.

  > The stack frame of a procedure `p` consists of data pushed to stack from the moment `call p` starts executing to the moment `call another_p` is going to execute.

  <img src="https://p.ipic.vip/oozad7.png" alt="Screenshot 2023-11-22 at 11.48.03 PM" style="zoom:50%;" />

Then `subq $16, %rsp` is used to allocate a 16-byte stack space for the current procedure, `add_two`. 

As we can see later, only 8 bytes of this space are used for storing the argument `int a`. The question then arises: why allocate an extra 8 bytes? According to the System V Application Binary Interface [3], which mandates that the end of the input argument area must align on a 16-byte boundary (or a 32-byte boundary if `__m256` is passed on the stack). In simpler terms, the stack frame size must be a multiple of 16 bytes (or 32 bytes if `__m256` is passed on the stack). However, for compilers which don't use the System V AMD64 ABI, like `gcc`, they may not enforce the 16-byte alignment [4].

Finally, the argument `int a` is moved from the register `%edi` to the memory position `-4(%rbp)`. This means the argument 0 is adjacent to the previous `%rbp` value on the stack with no gaps

Above is the work the function prologue does. It actually saves the **caller-saved** registers. 

Hold on, isn't `add_two` the callee in this example?

**Actually, the function prologue saves these things under the assumption (for the purpose) that the procedure `add_two` may call other procedures later.** Then, `add_two` is the caller, and it has to save the **caller-saved** registers. In other words, if the procedure does not call any other procedures, the function prologue can be omitted. We will see some examples later.

Before concluding this post, let's briefly examine the appearance of function prologues in RISC-V and AArch64.

For `RISC-V rv64gc clang 17.0.1` the function prologue of `add_two` can be given by:

```assembly
add_two:                                # @add_two
        addi    sp, sp, -32
        sd      ra, 24(sp)                      # 8-byte Folded Spill
        sd      s0, 16(sp)                      # 8-byte Folded Spill
        addi    s0, sp, 32
        sw      a0, -20(s0)
```

The assembly code presented demonstrates that `s0` serves as the frame pointer in RISC-V architecture, analogous to `%rbp` in x86-64. The function prologue for `add_two` in RISC-V is different from its x86-64 counterpart in terms of:

1. In RISC-V, the stack frame for `add_two` is allocated as soon as control flow enters the function.
2. The frame pointer (`s0`) references the bottom of the most recent stack frame, contrasting with x86-64 where it typically points to the position storing the previous stack-frame base pointer.

For `armv8-a clang 17.0.1` the function prologue of `add_two` can be given by:

```assembly
add_two:                                // @add_two
        sub     sp, sp, #32
        stp     x29, x30, [sp, #16]             // 16-byte Folded Spill
        add     x29, sp, #16
        stur    w0, [x29, #-4]
```

`x29` is equivalent to `s0`, and `x30` is equivalent to `ra`. The frame pointer (`x29`) points to the position where the previous `x29` is stored, similar to the approach used in x86-64.

> **Red Zone**
>
> The 128-byte area beyond the location pointed to by `%rsp` is considered to be reserved and shall not be modified by signal or interrupt handlers. Therefore, functions may use this area for temporary data that is not needed across function calls. In particular, leaf functions may use this area for their entire stack frame, rather than adjusting the stack pointer in the prologue and epilogue. This area is known as the red zone [3].

## References

**1** Function prologue and epilogue https://en.wikipedia.org/wiki/Function_prologue_and_epilogue

**2** Intel® 64 and IA-32 Architectures Software Developer's Manual Volume 1: Basic Architecture Chap. 6.2 (https://cdrdv2.intel.com/v1/dl/getContent/671436)

**3** System V Application Binary Interface https://refspecs.linuxbase.org/elf/x86_64-abi-0.99.pdf

**4** System V ABI - AMD64 - Stack alignment in GCC-emitted assembly https://stackoverflow.com/questions/64627897/system-v-abi-amd64-stack-alignment-in-gcc-emitted-assembly
