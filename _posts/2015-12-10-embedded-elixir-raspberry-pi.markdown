---
layout: post
title:  "Elixir on the Raspberry Pi - Blinking an LED"
date:   2015-12-10 11:03:46
tags: erlang elxir
---

In this post we will see how to run the "Hello, World" of embedded devices, blinking an LED on a breadboard. We will be using the Elixir programming language and a Raspberry Pi.

I have also written up similar instructions for the [BeagleBone Black][beaglebone-post].

[beaglebone-post]: {% post_url 2015-12-09-embedded-elixir-beaglebone %}

The final result will look like this:

<iframe width="420" height="315" src="https://www.youtube.com/embed/w6T2HXzHXRs" frameborder="0" allowfullscreen></iframe>



# Elixir programming language

[Elixir][elixir] describes itself:

```
Elixir is a dynamic, functional language designed for building scalable and
maintainable applications.

Elixir leverages the Erlang VM, known for running low-latency, distributed and
fault-tolerant systems, while also being successfully used in web development and
the embedded software domain.
```

[elixir]: http://elixir-lang.org/

Some of Elixir's selling points are:

* Runs on the rock solid Erlang Virtual Machine.
* Offers trivial interop with Erlang code, libraries, and frameworks including the [OTP][otp].
* Code looks a fair bit like Ruby which many may find easier to grok than Erlang's Prolog inspired syntax.

So far it has been an absolute joy to use.

[otp]: https://en.wikipedia.org/wiki/Open_Telecom_Platform

# Raspberry Pi

The [Raspberry Pi][raspberry-pi] is a series of small (credit card sized) and relatively low cost computers capable of running Linux with a number of [general-purpose input/output (GPIO)][gpio] pins which can interface with the outside world.

[raspberry-pi]: https://www.raspberrypi.org/
[gpio]: https://en.wikipedia.org/wiki/General-purpose_input/output

![Raspberry Pi]({{ site.url }}images/raspberry-pi.jpg)

<sub>Image by Lucasbosch (Own work) [<a href="http://creativecommons.org/licenses/by-sa/3.0">CC BY-SA 3.0</a>], <a href="https://commons.wikimedia.org/wiki/File%3ARaspberry_Pi_B%2B_top.jpg">via Wikimedia Commons</a></sub>



Now lets install the software dependencies.

# Install Erlang and Elixir

Elixir currently requires Erlang 17.0 or later, the debian packages in the default repositories are too old so we will need an alternative installation method.

One possibility would be to use the [nerves project][nerves]. I recently watched the [ElixirConf 2015 - Embedded Elixir in Action by Garth Hitchens][embedded-elixir-video] presentation and am excited to see where it goes, but for this example it would probably be overkill.

On a desktop PC another option is to use one of the [Erlang Solutions repos][erlang-solutions], but as far as I can tell the debian packages are only built for x86 architectures and the ones for Raspbian have not been updated since Erlang 15.

So it looks like we'll be installing from source.

[erlang-solutions]: https://packages.erlang-solutions.com/erlang/
[embedded-elixir-video]: https://www.youtube.com/watch?v=kpzQrFC55q4
[nerves]: http://nerves-project.org/

```sh
# ssh in and run these commands on your Raspberry Pi
# It should take you about an hour from start to finish

# Download, compile, and install Erlang
$ apt-get install wget libssl-dev ncurses-dev m4 unixodbc-dev erlang-dev
$ wget http://www.erlang.org/download/otp_src_18.1.tar.gz
$ tar -xzvf otp_src_18.1.tar.gz
$ cd otp_src_18.1/
$ export ERL_TOP=`pwd`
$ ./configure
$ make
$ make install

# Download a precompiled elixir release from
# https://github.com/elixir-lang/elixir/releases/
$ apt-get install unzip
$ wget https://github.com/elixir-lang/elixir/releases/download/v1.1.1/Precompiled.zip
$ unzip Precompiled.zip -d elixir

# Add elixir to your path
# You may want to add this to your .bashrc so you do not have to every time you
# log on
$ export PATH="/home/pi/elixir/bin:$PATH"


# Ensure Elixir is working
$ iex
Erlang/OTP 18 [erts-7.1] [source] [async-threads:10] [hipe] [kernel-poll:false]
Interactive Elixir (1.1.1) - press Ctrl+C to exit (type h() ENTER for help)
iex(1)> 1 + 2
3
iex(2)>
# Press Ctrl+C twice to exit iex
```

We're now ready to explore GPIO (general purpose I/O) on the Pi.

# Wire up the LED

![schematic]({{ site.url }}images/raspberry-pi-led-fritzing.png)

---
Note: The GPIO pins can only handle 3.3 volts, so be very careful that you do not accidentally connect a jumper to one of the 5 volt source pins. If you are unsure of what you are doing I would highly recommend reading all of the [Raspberry Pi documentation][raspberry-pi-docs] to make sure you do not damage your board.

[raspberry-pi-docs]: https://www.raspberrypi.org/documentation/

---

1. Using a jumper wire connect GND (ground) on the Pi to the negative rail on the breadboard.
2. Place an LED in the breadboard.
3. Using a jumper wire connect the cathode (shorter) wire of the LED to the negative rail.
4. Connect one end of a 100 ohm resistor to the anode (longer) wire of the LED.
5. Using another jumper wire connect the other end of the resistor to GPIO 4.

Once wired up we can proceed.

# Turn an LED on and off on the command line

In this example we'll be using the built in [sysfs] to control the GPIO pins. Wikipedia describes it:

```
sysfs is a virtual file system provided by the Linux kernel that exports information
about various kernel subsystems, hardware devices, and associated device drivers
from the kernel's device model to user space through virtual files. In addition to
providing information about various devices and kernel subsystems, exported virtual
files are also used for their configuring.
```

This allows us to treat the pins like a file, and while not the most efficient way to work with the GPIO pins, it is very convenient for some use cases.

When you follow along with the example below on a Pi it should make sense.

[sysfs]: https://en.wikipedia.org/wiki/Sysfs


```sh
# To make it easier in this example we run commands as root
pi@raspberrypi ~ $ sudo -i

# Add elixir to your root user's path
# You may want to add this to your .bashrc so you do not have to every time you
# log on
root@raspberrypi:~# export PATH="/home/pi/elixir/bin:$PATH"


# One gpio pin already exists
root@raspberrypi:~# ls /sys/class/gpio
export  gpiochip0  unexport

# Export a new one
root@raspberrypi:~# echo 4 > /sys/class/gpio/export

# Notice that gpio4 has now appeared
root@raspberrypi:~# ls /sys/class/gpio
export  gpio4  gpiochip0  unexport

# What we can do with gpio4
root@raspberrypi:~# ls /sys/class/gpio/gpio4
active_low  device  direction  edge  subsystem  uevent  value

# Set the direction to out
root@raspberrypi:~# echo out > /sys/class/gpio/gpio4/direction

# Turn on the LED
root@raspberrypi:~# echo 1 > /sys/class/gpio/gpio4/value

# Turn off the LED
root@raspberrypi:~# echo 0 > /sys/class/gpio/gpio4/value



# Now use Elixir to turn the LED on and then off
root@raspberrypi:~# iex
iex(1)> :os.cmd('echo 1 > /sys/class/gpio/gpio4/value')
[]
iex(2)> :os.cmd('echo 0 > /sys/class/gpio/gpio4/value')
[]

# Press Ctrl+C twice to exit iex

# Clean up
root@raspberrypi:~# echo 4 > /sys/class/gpio/unexport
```


Now lets make a module.

# Elixir Code

On your Raspberry Pi create a file called blink-led.ex with the following contents:

```elixir
defmodule BlinkLED do
  @moduledoc """
  Blink an LED on a Raspberry Pi

  ## Examples
  
  iex> c("blink-led.ex")
  [BlinkLED]
  iex> {:ok, pid} = BlinkLED.start_link()
  {:ok, #PID<0.102.0>}
  
  """

  @doc """
  Setup and start the process
  """
  def start_link() do
    :os.cmd('echo 4 > /sys/class/gpio/export')
    :os.cmd('echo out > /sys/class/gpio/gpio4/direction')
    {:ok, spawn_link(fn -> loop() end)}
  end

  defp loop() do
    :os.cmd('echo 1 > /sys/class/gpio/gpio4/value')
    :timer.sleep(1000)
    :os.cmd('echo 0 > /sys/class/gpio/gpio4/value')
    :timer.sleep(1000)
    loop()
  end
end
```

To run the code you can start iex and do the following:

```sh
iex> c("blink-led.ex")
iex> {:ok, pid} = BlinkLED.start_link()
```

The LED on the breadboard should now turn on for one second, turn off for a second, and repeat indefinitely.


