# Building a Five-Stage MIPS Processor

In this blog series, we'll be building a five-stage MIPS processor from scratch in under a month—because if we don't, I'll fail my computer architecture course! 😭

Just so you know, here's what my setup looks like:

```shell
$ uname -a
Darwin MacBook-Pro.local 23.4.0 Darwin Kernel Version 23.4.0: Fri Mar 15 00:12:41 PDT 2024; root:xnu-10063.101.17~1/RELEASE_ARM64_T8103 arm64
```

Before we start, let's set up the required toolchains:

```shell
$ brew install verilator llvm@17
$ echo 'export PATH="/opt/homebrew/opt/llvm@17/bin:$PATH"' >> ~/.zshrc
```

Next, set up the framework:

```shell
$ git clone https://gitee.com/lsc2001/fdcpu.git mips32
$ cd mips32
$ make run -j128
```

If everything is set up correctly, there should be no errors.

For better development experience, add the following two paths to the `includePath` in VSCode. Please note that the paths may vary based on your setup, but you should be able to locate the correct ones on your machine:

```
/opt/homebrew/Cellar/verilator/5.024/share/verilator/include
/opt/homebrew/Cellar/verilator/5.024/share/verilator/include/vltstd
```