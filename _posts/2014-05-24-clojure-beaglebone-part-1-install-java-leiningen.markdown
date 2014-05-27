---
layout: post
title:  "Clojure on the BeagleBone part 1 - Installing Java, Leiningen, and Emacs 24"
date:   2014-05-24 14:11:46
categories: beaglebone clojure
---

# Intro
- In part 1 of this series we see how to install Java and [Leiningen][leiningen] on a [BeagleBone][beaglebone].
- In [part 2][part-2] we use the BeagleBone to blink an LED on a breadboard using [Clojure][clojure].


The [BeagleBone][beaglebone] is a small and low cost ($55) 1Ghz ARM board with 512Mb of RAM capable of running Linux.

![BeagleBone Black]({{ site.url }}/images/beagleboneblack.jpg)

These instructions assume that you are using Debian 2014-05-14 and running off a SD card as the root user. You can obtain the latest versions of Debian and Angstrom [here][beaglebone-firmware].

If you are using a different operating system or version you may need to make some changes.

# Java
I started with the [BeagleBone Oracle JDK instructions][beaglebone-java], but needed to make some changes (for instance because I am using Debian I can use "hard float" JDK - however if you are using Angstrom Linux you may need the "soft float" version - or you may want to use Java 8 instead).

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
Install following the [installation instructions here][leiningen]:

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


# Emacs 24.3

The latest version of Emacs in the Debian package list is 23, here is how to download and install 24.3. Note that generally you will be happier running Emacs on you laptop/desktop and using tramp-mode to edit files from there.

Run the following on your BeagleBone and go get a cup of coffee, it will take at least an hour.

```bash
$ apt-get install build-essential libncurses5-dev
$ wget http://ftp.gnu.org/gnu/emacs/emacs-24.3.tar.gz
$ tar xzvf emacs-24.3.tar.gz
$ cd emacs-24.3
$ ./configure --with-xpm=no --with-gif=no
$ make
$ make install
```


[part-2]: {% post_url 2014-05-25-clojure-beaglebone-part-2-blink-led-clojure %}
[leiningen]: https://github.com/technomancy/leiningen
[clojure]: http://clojure.org/
[clojurescript]: https://github.com/clojure/clojurescript
[beaglebone]: http://beagleboard.org/Products/BeagleBone+Black
[beaglebone-firmware]: http://beagleboard.org/latest-images
[beaglebone-java]: http://beagleboard.org/project/java/
[jdk-7-arm-downloads]: http://www.oracle.com/technetwork/java/javase/downloads/jdk7-arm-downloads-2187468.html