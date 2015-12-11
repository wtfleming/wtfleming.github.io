---
layout: post
title:  "Erlang clustering on the Raspberry Pi and BeagleBone with Elixir"
date:   2015-12-11 13:03:46
tags: erlang elxir
---

I have been looking at Elixir/Erlang clustering with credit card sized computers and using the [Phoenix web framework][phoenix] to communicate from the cluster to an Android tablet in realtime.
[phoenix]: http://www.phoenixframework.org/

I am pleasantly surprised at how easy it has been and how little code I had to write for this demo.

<iframe width="420" height="315" src="https://www.youtube.com/embed/p8XyvRWchEI" frameborder="0" allowfullscreen></iframe>

In the above video I am running an Erlang cluster consisting of a desktop x86 based PC on Ubuntu, a Raspberry Pi, a BeagleBone Black, and an Android tablet. Each of the nodes are running Erlang/OTP 18.1 and Elixir 1.1.1.

A process written in Elixir on the PC periodically communicates with the Raspberry Pi and BeagleBone to turn on and off LEDs connected via a [GPIO pin][gpio] to a breadboard, and concurrently sends a message to the tablet over a WebSocket in realtime.

[gpio]: https://en.wikipedia.org/wiki/General-purpose_input/output

![graph]({{ site.url }}images/embedded-elixir-cluster.dot.png)



# Android code
I simply took this [Android Phoenix Demo on GitHub][android-code], followed the instructions to update the host value, and installed in on a Nexus 7.

[android-code]: https://github.com/bryanjos/AndroidPhoenixDemo


# Raspberry Pi and BeagleBone Code

On both your Pi and BeagleBone create a file called gpio-led.ex with the following contents:

```elixir
defmodule GPIO.LED do
  use GenServer

  #####
  # External API
  def start_link(pin) do
    :os.cmd(to_char_list "echo #{pin} > /sys/class/gpio/export")
    :os.cmd(to_char_list "echo out > /sys/class/gpio/gpio#{pin}/direction")
    :os.cmd(to_char_list "echo 0 > /sys/class/gpio/gpio#{pin}/value")
    GenServer.start_link(__MODULE__, pin, name: __MODULE__)
  end

  def led_on! do
    GenServer.cast __MODULE__, :led_on
  end

  def led_off! do
    GenServer.cast __MODULE__, :led_off
  end


  #####
  # GenServer implementation
  def handle_cast(:led_on, pin) do
    :os.cmd(to_char_list "echo 1 > /sys/class/gpio/gpio#{pin}/value")
    {:noreply,  pin}
  end

  def handle_cast(:led_off, pin) do
    :os.cmd(to_char_list "echo 0 > /sys/class/gpio/gpio#{pin}/value")
    {:noreply,  pin}
  end
end
```

This is a pretty straightforward GenServer. For simplicity I am not using any supervisors in this example, i'll leave that as an exercise for the reader.

If you are curious about what is happening with the GPIO and want to learn more I have written up some information about getting started with Erlang/Elixir and GPIO on the [BeagleBone][beaglebone-post] and [Raspberry Pi][raspberry-pi-post].
[raspberry-pi-post]: {% post_url 2015-12-10-embedded-elixir-raspberry-pi %}
[beaglebone-post]: {% post_url 2015-12-09-embedded-elixir-beaglebone %}


# Web server code
I started with the [Phoenix chat example on GitHub][chat-github]. Clone the repo to your desktop or laptop.
[chat-github]: https://github.com/chrismccord/phoenix_chat_example

Next create a file called phoenix\_chat\_example/lib/chat/led_controller.ex with the following contents:

```elixir
defmodule Chat.LedController do

  def blink_leds() do
    # Ensure we are connected
    true = Node.connect :"beagle@beaglebone.local"
    true = Node.connect :"pi@raspberrypi.local"

    # Ensure the GPIO.LED servers have started on the Raspberry Pi and BeagleBone
    :rpc.call(:"beagle@beaglebone.local", GPIO.LED, :start_link, [23])
    :rpc.call(:"pi@raspberrypi.local", GPIO.LED, :start_link, [4])

    loop()
  end

  defp loop() do
    Chat.Endpoint.broadcast! "rooms:lobby", "new:msg", %{user: "server",
                                                         body: "BeagleBone ON"}
    :rpc.call(:"beagle@beaglebone.local", GPIO.LED, :led_on!, [])
    :timer.sleep(1000)
    :rpc.call(:"beagle@beaglebone.local", GPIO.LED, :led_off!, [])

    Chat.Endpoint.broadcast! "rooms:lobby", "new:msg", %{user: "server",
                                                         body: "Pi ON"}
    :rpc.call(:"pi@raspberrypi.local", GPIO.LED, :led_on!, [])
    :timer.sleep(1000)
    :rpc.call(:"pi@raspberrypi.local", GPIO.LED, :led_off!, [])

    loop()
  end
end
```

This is also straightforward.

* Send a message to a [Phoenix Channel][channel-doc] (which in turn gets forwarded to the Android app via websocket).
* Periodically make [rpc][rpc-doc] calls to the nodes on the Raspberry Pi and Beaglebone to turn on and off the LEDs
* Sleep for a second
* Repeat

[rpc-doc]: http://www.erlang.org/doc/man/rpc.html
[channel-doc]: http://www.phoenixframework.org/docs/channels

Once started the code will recursively loop forever.

# Run the code

ssh to the Raspberry Pi as the root user

```sh
# Start an Erlang node
root@raspberrypi:~# iex --name pi@raspberrypi.local --cookie peanut-butter

# Compile
iex(pi@raspberrypi.local)1> c("gpio-led.ex")
```

ssh to the BeagleBone as the root user

```sh
root@beaglebone:~# iex --name beagle@beaglebone.local --cookie peanut-butter
iex(beagle@beaglebone.local)1> c("gpio-led.ex")
```

On your desktop or laptop run the code as an [Elixir Task][elixir-task] :

[elixir-task]: http://elixir-lang.org/docs/v1.1/elixir/Task.html

```sh
# Start the Phoenix app
$ iex --name desktop@desktop.local --cookie peanut-butter -S mix phoenix.server

# Blink the LEDs
iex(1)> {:ok, pid} = Task.start(fn -> Chat.LedController.blink_leds end)

```

The LEDs should be turning on and off and you should be seeing messages from Elixir in the Android app.
