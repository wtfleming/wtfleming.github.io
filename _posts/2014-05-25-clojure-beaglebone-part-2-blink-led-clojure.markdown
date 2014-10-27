---
layout: post
title:  "Clojure on the BeagleBone part 2 - Blinking an LED with Clojure"
date:   2014-05-25 14:11:46
tags: beaglebone clojure
---

# Intro
- In [part 1][part-1] of this series we see how to install Java and [Leiningen][leiningen] on a [BeagleBone][beaglebone].
- In part 2 we use the BeagleBone to blink an LED on a breadboard using [Clojure][clojure].
- In [part 3][part-3] we will blink an LED using [ClojureScript][clojurescript].
- In [part 4][part-4] we will read digital inputs via polling and interrupts.

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


# Clojure code

SSH into your BeagleBone and create a file named *project.clj* with the following contents:

```clojure
(defproject clj-blink-led "0.1.0"
  :description "Blink a LED on a BeagleBone"
  :license {:name "Eclipse Public License"
            :url "http://www.eclipse.org/legal/epl-v10.html"}
  :dependencies [[org.clojure/clojure "1.6.0"]]
  :main clj-blink-led.core)
```

And create a file name *src/clj\_blink\_led/core.clj* with these contents:

```clojure
(ns clj-blink-led.core
  (:require [clojure.java.io :as io]))

(defn write-to-filesystem
  "Helper function for setting pins"
  [location val]
  (with-open [f (io/output-stream location)]
    (.write f (.getBytes val))))

(defn cleanup
  "Tidy up when a user presses Ctrl-C to exit"
  []
  (println "Shutting down...")
  (write-to-filesystem "/sys/class/gpio/unexport" "23"))

(defn setup
  "Export pin and set the direction"
  []
  (.addShutdownHook (Runtime/getRuntime) (Thread. cleanup))
  (write-to-filesystem "/sys/class/gpio/export" "23")
  (write-to-filesystem "/sys/class/gpio/gpio23/direction" "out"))

; Pin states
(def HIGH "1")
(def LOW "0")

(defn -main []
  (println "Blinking LED, press Ctrl-C to exit")
  (setup)
  (loop [pin-state HIGH]
    (write-to-filesystem "/sys/class/gpio/gpio23/value" pin-state)
    (Thread/sleep 1000)
    (recur (if (= pin-state HIGH) LOW HIGH))))
```

Now run it on your BeagleBone as the root user.

```bash
$ lein run
```

Your LED should now blink on and off every second.

In the [next part][part-3] of this series we will see how to blink a LED using node.js and use [ClojureScript][clojurescript] instead of Clojure.


[part-1]: {% post_url 2014-05-24-clojure-beaglebone-part-1-install-java-leiningen %}
[part-3]: {% post_url 2014-07-14-clojure-beaglebone-part-3-blink-led-clojurescript %}
[part-4]: {% post_url 2014-10-26-clojure-beaglebone-part-4-digital-input-clojurescript %}
[leiningen]: https://github.com/technomancy/leiningen
[clojure]: http://clojure.org/
[clojurescript]: https://github.com/clojure/clojurescript
[beaglebone]: http://beagleboard.org/Products/BeagleBone+Black
[beaglebone-book]: http://www.amazon.com/gp/product/1449345379/ref=as_li_tl?ie=UTF8&camp=1789&creative=390957&creativeASIN=1449345379&linkCode=as2&tag=wtfblog08-20&linkId=MUJWLN254WMPPISY"
[fritzing]: http://fritzing.org/home/
[matt-richardson]: http://mattrichardson.com/
