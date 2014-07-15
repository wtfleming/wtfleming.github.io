---
layout: post
title:  "Clojure on the BeagleBone part 3 - Blinking an LED with ClojureScript"
date:   2014-07-14 10:21:46
tags: beaglebone clojure
---

# Intro
- In [part 1][part-1] of this series we saw how to install Java and [Leiningen][leiningen] on a [BeagleBone][beaglebone].
- In [part 2][part-2] we used the BeagleBone to blink an LED on a breadboard using [Clojure][clojure].
- In part 3 we will blink an LED using [ClojureScript][clojurescript].

The BeagleBone is a 1GHz ARM board with 512Mb of RAM capable of running Linux. The Debian image ships with node.js and a javascript library in [Bonescript][bonescript] for interacting with the hardware. Clojurescript provides a compiler for Clojure that targets Javascript, here we will use it to blink an LED on a breadboard using the BeagleBone GPIO.

# Hello World with Clojurescript and node.js

First we will ensure that ClojureScript and node.js are setup. Ensure you have followed the instructions in the first part of this series to install Leiningen.

SSH into your BeagleBone and create a file named *project.clj* with the following contents:

```clojure
(defproject cljs-nodejs-hello-world "0.0.1"
  :description "Hello World example for clojurescript on node.js"
  :license {:name "Eclipse Public License"
            :url "http://www.eclipse.org/legal/epl-v10.html"}
  :plugins [[lein-cljsbuild "1.0.3"]]
  :cljsbuild {
    :builds [{
        :source-paths ["src"]
        :compiler {
          :output-to "lib/hello-world.js"
          :optimizations :simple
          :target :nodejs
          :pretty-print true}}]}
  :dependencies [[org.clojure/clojurescript "0.0-2197"]])
```

And create a file name *src/cljs\_helloworld/core.cljs* with these contents:

```clojure
ns cljs-helloworld.core
  (:require [cljs.nodejs :as nodejs]))

(defn -main [& args]
  (println (apply str (map [\space "world" "hello"] [2 0 1]))))

; Let println work
(nodejs/enable-util-print!)

; Tell node which function to use as main
(set! *main-cli-fn* -main)
```

Now compile the clojurescript to javascript and run it on your BeagleBone.

```bash
$ lein cljsbuild once
$ node lib/hello-world.js
```

You should see hello world output.


# Blinking an LED

This is inspired by an example from the excellent book [Getting Started With BeagleBone][beaglebone-book] by [Matt Richardson][matt-richardson].

![schematic]({{ site.url }}images/beaglebone-clojure-blink-led-fritzing.png)

Schematic above was generated using the open source [Fritzing][fritzing].

---
Note: The GPIO pins can only handle 3.3 volts, so be very careful that you do not accidentally connect a jumper to one of the 5 volt source pins. If you are unsure of what you are doing I would highly recommend reading the system reference manual to make sure you do not damage your board.

---

# Wire up the LED
1. Using a jumper wire connect Pin 2 on Header P9 (ground) on the BeagleBone to the negative rail on the breadboard.
2. Place an LED in the breadboard.
3. Using a jumper wire connect the cathode (shorter) wire of the LED to the negative rail.
4. Connect one end of a 100 ohm resistor to the anode (longer) wire of the LED.
5. Using another jumper wire connect the other end of the resistor to Pin 13 on Header P8

Now we are ready to write the code.

# ClojureScript code

SSH into your BeagleBone and create a file named *project.clj* with the following contents:

```clojure
(defproject cljs-beaglebone-blink-led "0.0.1"
  :description "Hello World example for clojurescript on node.js"
  :license {:name "Eclipse Public License"
            :url "http://www.eclipse.org/legal/epl-v10.html"}
  :plugins [[lein-cljsbuild "1.0.3"]]
  :cljsbuild {
    :builds [{
        :source-paths ["src"]
        :compiler {
          :output-to "lib/blink.js"
          :optimizations :simple
          :target :nodejs
          :pretty-print true}}]}
  :dependencies [[org.clojure/clojurescript "0.0-2197"]])
```

And create a file name *src/cljs\_blink\_led/core.cljs* with these contents:

```clojure
(ns cljs-blink-led.core
  (:require [cljs.nodejs :as nodejs]))

(def bone (nodejs/require "bonescript"))

; Bonescript identifiers related to pins
(def OUTPUT (aget bone "OUTPUT"))
(def HIGH (aget bone "HIGH"))
(def LOW (aget bone "LOW"))


; LEDs
(def led-pin "P8_13")    ; GPIO pin 13 on header P8
(def onboard-led "USR3") ; One of the onboard LEDs

; State of our LEDs
(def led-pin-state (atom LOW))

; Set both pins as an output
(defn setup-pins []
  (.pinMode bone led-pin OUTPUT)
  (.pinMode bone onboard-led OUTPUT))

(defn toggle-digital-pin-state []
  (if (= @led-pin-state HIGH)
    (reset! led-pin-state LOW)
    (reset! led-pin-state HIGH)))


(defn blink-leds []
  (toggle-digital-pin-state)
  (.digitalWrite bone led-pin @led-pin-state)
  (.digitalWrite bone onboard-led @led-pin-state))


(defn -main [& args]
  (setup-pins)
  (js/setInterval blink-leds 1000))

(set! *main-cli-fn* -main)
```

Now compile the clojurescript to javascript and run it on your BeagleBone.

```bash
$ lein cljsbuild once
$ node lib/blink.js
```

Your LED should now blink on and off every second.



[part-1]: {% post_url 2014-05-24-clojure-beaglebone-part-1-install-java-leiningen %}
[part-2]: {% post_url 2014-05-25-clojure-beaglebone-part-2-blink-led-clojure %}
[leiningen]: https://github.com/technomancy/leiningen
[clojure]: http://clojure.org/
[bonescript]: http://beagleboard.org/Support/BoneScript
[clojurescript]: https://github.com/clojure/clojurescript
[beaglebone]: http://beagleboard.org/Products/BeagleBone+Black
[beaglebone-book]: http://www.amazon.com/gp/product/1449345379/ref=as_li_tl?ie=UTF8&camp=1789&creative=390957&creativeASIN=1449345379&linkCode=as2&tag=wtfblog08-20&linkId=MUJWLN254WMPPISY"
[fritzing]: http://fritzing.org/home/
[matt-richardson]: http://mattrichardson.com/
