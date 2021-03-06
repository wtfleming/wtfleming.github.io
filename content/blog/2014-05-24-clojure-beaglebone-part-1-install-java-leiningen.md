+++
title = "Clojure on the BeagleBone part 1 - Installing Java, Leiningen, and Emacs 24"
[taxonomies]
tags = [ "clojure", "beaglebone" ]
+++


# Intro
- In part 1 of this series we see how to install Java and [Leiningen](https://github.com/technomancy/leiningen) on a [BeagleBone](https://beagleboard.org/black).
- In [part 2](@/blog/2014-05-25-clojure-beaglebone-part-2-blink-led-clojure.md) we use the BeagleBone to blink an LED on a breadboard using [Clojure](https://clojure.org/).
- In [part 3](@/blog/2014-07-14-clojure-beaglebone-part-3-blink-led-clojurescript.md) we will blink an LED using [ClojureScript](https://github.com/clojure/clojurescript).
- In [part 4](@/blog/2014-10-23-clojure-beaglebone-part-4-digital-input-clojurescript.md) we will read digital inputs via polling and interrupts.

The [BeagleBone](https://beagleboard.org/black) is a small and low cost ($55) 1Ghz ARM board with 512Mb of RAM capable of running Linux.

![BeagleBone Black](/images/beagleboneblack.jpg)

These instructions assume that you are using Debian 2014-05-14 as the root user. You can obtain the latest versions of Debian and Angstrom [here](https://beagleboard.org/latest-images).

If you are using a different operating system or version you may need to make some changes.

# Java
I started with the [BeagleBone Oracle JDK instructions](https://beagleboard.org/project/java/), but needed to make some changes (for instance because I am using Debian I can use "hard float" JDK - however if you are using Angstrom Linux you may need the "soft float" version - or you may want to use Java 8 instead).

SSH into your BeagleBone and do the following:

```bash
# You must accept the Oracle Binary Code License Agreement for Java SE.
# The license and download links are available at:
# http://www.oracle.com/technetwork/java/javase/downloads/jdk7-arm-downloads-2187468.html
# You can accept the license via wget like this:
$ wget --no-check-certificate --no-cookies --header "Cookie: oraclelicense=accept-securebackup-cookie" http://download.oracle.com/otn-pub/java/jdk/7u55-b13/jdk-7u55-linux-arm-vfp-hflt.tar.gz
$ tar xzf jdk-7u55-linux-arm-vfp-hflt.tar.gz
$ export PATH=$PATH:/root/jdk1.7.0_55/bin
$ export JAVA_HOME=/root/jdk1.7.0_55
$ java -version
java version "1.7.0_55"
Java(TM) SE Runtime Environment (build 1.7.0_55-b13)
Java HotSpot(TM) Client VM (build 24.55-b03, mixed mode)
```

You will want to store all the exports from this post in your .bashrc so you do not need to type them in every time you log in.

# Leiningen
Install following the [installation instructions here](https://github.com/technomancy/leiningen):

```bash
$ mkdir bin
$ cd bin
$ wget https://raw.githubusercontent.com/technomancy/leiningen/stable/bin/lein
$ chmod 755 lein
$ export PATH=$PATH:/root/bin

# Generally you do not want to run as root, but since we will want access
# to the GPIO pins it is easier to develop on a BeagleBone as root.
# Turn off leiningen's warning about running as root.
$ export LEIN_ROOT=1
```

Now lets fire up a REPL and make sure it works.

```bash
$ lein repl
user=> (println "Hello BeagleBone!")
Hello BeagleBone
nil
```


# Emacs 24.4

The latest version of Emacs in the Debian package list is 23, here is how to download and install 24.4. Note that generally you will be happier running Emacs on you laptop/desktop and using tramp-mode to edit files from there.

Run the following on your BeagleBone and go get a cup of coffee, it will take at least an hour.

```bash
$ apt-get install build-essential libncurses5-dev
$ wget http://ftp.gnu.org/gnu/emacs/emacs-24.4.tar.gz
$ tar xzvf emacs-24.4.tar.gz
$ cd emacs-24.4
$ ./configure --with-xpm=no --with-gif=no --without-x
$ make
$ make install
```



