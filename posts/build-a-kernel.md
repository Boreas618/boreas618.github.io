# Build a Kernel for Raspberry Pi

> [!important]
>
> This post is based on the content in [Learning operating system development using Linux kernel and Raspberry Pi](https://github.com/s-matyukevich/raspberry-pi-os/blob/master/docs/lesson01/rpi-os.md).

To build a kernel capable of booting on a Raspberry Pi, a Makefile, a linker script and a startup stub code are needed.

## Makefile

Checkout a naive Makefile to build the kernel image:

```makefile
# The cross-compiler
ARMGNU ?= aarch64-linux-gnu

COPS = -Wall -nostdlib -nostartfiles -ffreestanding -Iinclude -mgeneral-regs-only
ASMOPS = -Iinclude 

BUILD_DIR = build
SRC_DIR = src

all : kernel8.img

clean :
    rm -rf $(BUILD_DIR) *.img 

# Compile .c files to .o files
$(BUILD_DIR)/%_c.o: $(SRC_DIR)/%.c
    mkdir -p $(@D)
    $(ARMGNU)-gcc $(COPS) -MMD -c $< -o $@

# Compile .S files to .o files
$(BUILD_DIR)/%_s.o: $(SRC_DIR)/%.S
    $(ARMGNU)-gcc $(ASMOPS) -MMD -c $< -o $@

C_FILES = $(wildcard $(SRC_DIR)/*.c)
ASM_FILES = $(wildcard $(SRC_DIR)/*.S)
OBJ_FILES = $(C_FILES:$(SRC_DIR)/%.c=$(BUILD_DIR)/%_c.o)
OBJ_FILES += $(ASM_FILES:$(SRC_DIR)/%.S=$(BUILD_DIR)/%_s.o)

DEP_FILES = $(OBJ_FILES:%.o=%.d)
-include $(DEP_FILES)

# Depends on linker.ld and the object files
kernel8.img: $(SRC_DIR)/linker.ld $(OBJ_FILES)
		# Link all of the object files to form kernel8.elf
    $(ARMGNU)-ld -T $(SRC_DIR)/linker.ld -o $(BUILD_DIR)/kernel8.elf  $(OBJ_FILES)
    $(ARMGNU)-objcopy $(BUILD_DIR)/kernel8.elf -O binary kernel8.img
```

The options for compiling C files are:

* `Wall` show all warnings.
* `nostdlib` don't use the C standard library.
* `nostartfiles` don't use standard startup files.
* `ffreestanding` directs the compiler to not assume that standard functions have their usual definition.
* `Iinclude` search for header files in the include folder.
* `mgeneral-regs-only` use only general-purpose registers.

**The `-MMD` option**: When you compile a source file in C or C++, the compiler needs to know all the header files that the source file depends on, so it can recompile the source file whenever any of the headers change. Normally, you'd have to keep track of these dependencies manually. The `-MMD` flag automates this process. When you compile a source file with this flag, GCC generates a `.d` file along with the object file. This `.d` file contains Makefile rules that list all the header files that the source file depends on.

**`aarch64-linux-gnu-objcopy`**: We need to extract all executable and data sections from the ELF file and put them into the `kernel8.im`g image.

The trailing `8` of `kernel8.img` denotes ARMv8 which is a 64-bit architecture. The bootloader looks for `kernel8.img` on a 64-bit Raspberry Pi (ARMv8). You can also customize this by modifying `config.txt`in the boot section. For example, by using `arm_control=0x200` flag in the config.txt file. 

## Linker Script

```
SECTIONS
{
    .text.boot : { *(.text.boot) }
    .text :  { *(.text) }
    .rodata : { *(.rodata) }
    .data : { *(.data) }
    . = ALIGN(0x8);
    bss_begin = .;
    .bss : { *(.bss*) } 
    bss_end = .;
}
```

After startup, the Raspberry Pi loads `kernel8.img` into memory and starts execution from the beginning of the file. That's why the `.text.boot` section must be first; we are going to put the OS startup code inside this section.

## Startup Stub

```assembly
#include "mm.h"

.section ".text.boot"

.globl _start
_start:
    mrs    x0, mpidr_el1        
    and    x0, x0,#0xFF        // Check processor id
    cbz    x0, master        // Hang for all non-primary CPU
    b    proc_hang

proc_hang: 
    b proc_hang

master:
    adr    x0, bss_begin
    adr    x1, bss_end
    sub    x1, x1, x0
    bl     memzero

    mov    sp, #LOW_MEMORY
    bl    kernel_main
```

Everything defined in `boot.S` should go in the `.text.boot` section. After the bss section is cleared up, we enter `kernel_main`.

## Advanced: Generating a Boot Image

In the lab of Operating Systems (Horner Track), we are required to generate a boot image ourselves (luckily, TAs have finished this part for you). In this section, I will explain how the script for generating the boot image functions internally.

First of all, what files need to be included in the boot image? As shown in `boot/CMakeLists`:

```cmake
set(boot_files
    "${kernel_image}" # expected to be kernel8.img
    "armstub8-rpi4.bin"
    "bootcode.bin"
    "config.txt"
    "COPYING.linux"
    "fixup_cd.dat"
    "fixup.dat"
    "fixup4.dat"
    "fixup4cd.dat"
    "LICENCE.broadcom"
    "start_cd.elf"
    "start.elf"
    "start4.elf"
    "start4cd.elf")
```

Then, this file list is passed to the Python script `generate-image.py` to generate the boot image. Let's examine the script.

```python
def generate_boot_image(target, files):
  sh(f'dd if=/dev/zero of={target} seek={n_boot_sectors - 1} bs={sector_size} count=1')
  
  sh(f'mkfs.vfat -F 32 -s 1 {target}')

  for file in files:
    sh(f'mcopy -i {target} {file} ::{Path(file).name};')
```

The `target` is the name of the image to be generated (`boot.img` in this case).

The first line creates `boot.img` in the current folder by writing zeros to the last sector. This process creates a `boot.img` file with the size `n_boot_sectors * sector_size`.

The second line formats the file system in the generated `boot.img`. `-F 32` specifies FAT32. `-s 1` specifies one sector per cluster, allowing for the creation of a smaller image.

The `mcopy` command is part of the Mtools package, a collection of utilities for accessing MS-DOS disks from Unix without mounting them. It is used to copy files to or from DOS file systems (like FAT12, FAT16, FAT32). The files are copied to the `boot.img`, which is formatted in FAT.

----

It certainly sounds elegant, doesn't it? We can even mount the created `boot.img` on our local machine to explore the contents of the generated image.

On macOS, the image can be mounted using the following steps:

```shell
mkdir ~/my-fat32-image
hdiutil attach -mountpoint ~/my-fat32-image /path/to/your/image.img
```

If all goes according to plan, you should be able to view the files detailed in the previously mentioned list.

---

After the boot image has been generated, it will be included in the final `sd.img` along with the `fs.img`. The `sd.img` will represent the virtual SD card that is inserted into qemu.

## Further: Raspberry Pi Boot Sequence

Now we have everything needed to boot the Raspberry Pi. How does the Raspberry Pi utilize these files? (Note that this part is less relevant to the kernel, but it's still interesting to discuss.)

The booting process can be summarized in the following figure. Note that it greatly differs from how legacy x86 machines boot. The control flow is sequentially transferred through the following components: `ROM Firmware -> bootcode.bin -> loader.bin -> start.elf -> kernel.img`.

<img src="https://i.stack.imgur.com/xEB4q.png" alt="Boot Sequence" style="zoom:50%;" />