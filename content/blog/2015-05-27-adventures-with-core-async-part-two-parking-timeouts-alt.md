+++
title = "Adventures in Clojure with core.async - Part 2 - Timeouts and Working with Multiple Channels via Parking and alts!"
[taxonomies]
tags = [ "clojure", "clojurescript" ]
+++


# Introduction

- In [part 1](@/blog/2015-04-15-adventures-with-core-async-part-one-channels-messages.md) of this series we looked at the basics of core.async via channels and messages.
- In part 2 we will explore timeouts and working with multiple channels using examples of calling out to web APIs.


We will be using the example of a web site that wants to display weather information and will be making mock calls to the [OpenWeatherMap API][OpenWeatherMap] and [Weather Underground API][wunderground] to demonstrate using multiple channels with core.async


[OpenWeatherMap]: http://openweathermap.org/api
[wunderground]: http://www.wunderground.com/weather/api

# Helper Function

First we define a function that will be used repeatedly in the examples.

```clojure
(defn set-inner-html!
  "Helper function to set contents of a DOM element."
  [elem value]
  (set! (.-innerHTML (goog.dom/getElement elem)) value))
```

It modifies DOM elements using the Google Closure Library.

# Working with Timeouts

Let say that when a button is clicked we want to wait a second before continuing. Click the button below to see it in action.

---

<section>
<span>Output: </span>
<span id="timeout-output"></span>
</section>
<button id="timeout-button">Run Code</button>

---

The steps taken look like this:

![timeout-diagram](/images/core-async-part-two/timeout.png)

In Clojure we could run in a different thread and use the Thread/sleep method provided by the Java virtual machine. But since ClojureScript uses a JavaScript runtime (which is single threaded) we don't have as straightforward of a solution.

One approach would be to call js/setTimeout and pass it a call back function. But here we will use the [timeout][timeout-function] function provided by core.async.

[timeout-function]: https://clojure.github.io/core.async/#clojure.core.async/timeout


Given a html fragment like:

```html
<section>
  <span>Output: </span>
  <span id="timeout-output"></span>
</section>
<button id="timeout-button">Click me</button>
```

When the button is clicked we can wait for 1 second and then make a DOM change like this:

```clojure
(defn handle-timeout-button-click
  "Example of timeouts."
  [_]
  (set-inner-html! "timeout-output" "Button clicked, waiting...")
  (go
    (<! (timeout 1000))
    (set-inner-html! "timeout-output" "Finished after waiting 1 second.")))
```

**timeout** returns a channel that will close and **<!** will park until a value becomes available or the channel is closed.


# Mock API Call Functions
The remaining examples will use these functions to simulate calling out to a couple APIs.

```clojure
(defn mock-api-call
  "Wait ms milliseconds. Returns a channel containing the message"
  [ms msg]
  (go
    (<! (timeout ms))
    msg))

(defn weather-underground-api-call []
  (mock-api-call (rand-int 1500) "Weather Underground responded."))

(defn open-weather-map-api-call []
  (mock-api-call (rand-int 1500) "OpenWeatherMap responded."))
```

They take a random amount of time (up to 1.5 seconds) to return results. Note that a go block returns a channel which in this case will contain the message from the API.

# Working with Multiple Channels via Parking

In this example we will demonstrate calling out to two APIs, waiting for both to return results, and then display both of them.

![parking-diagram](/images/core-async-part-two/parking.png)

```clojure
(defn handle-parking-button-click
  "Call two APIs. Output results from both."
  [_]
  (set-inner-html! "parking-output" "Calling APIs, waiting for results.")
  (go
    (let [weather-underground-chan    (weather-underground-api-call)
          open-weather-map-chan       (open-weather-map-api-call)
          weather-underground-message (<! weather-underground-chan)
          open-weather-map-message    (<! open-weather-map-chan)
          msg (str weather-underground-message " " open-weather-map-message)]
      (set-inner-html! "parking-output" msg))))
```

<section>
<span>Output: </span>
<span id="parking-output"></span>
</section>
<button id="parking-button">Run Code</button>

---

Under the hood the go block will transform its body to a state machine and wait until both of the calls to [<!][rec-docs] have received a value.

[rec-docs]: https://clojure.github.io/core.async/#clojure.core.async/<!



# Working with Multiple Channels via alts!

In this example we will demonstrate calling out to two APIs, return results from the one that finishes the fastest, and then display it.

Since these are both weather services, in all likelihood they will return similar values, so we might do this if all we care about is getting a result and displaying it as fast as possible.


![alts-diagram](/images/core-async-part-two/alts.png)

```clojure
(defn handle-alts-button-click
  "Call two APIs. Output results from the first to return."
  [_]
  (set-inner-html! "alts-output" "Calling APIs, waiting for results.")
  (go
    (let [weather-underground-chan (weather-underground-api-call)
          open-weather-map-chan    (open-weather-map-api-call)
          [msg]                    (alts!
                                     [weather-underground-chan
                                     open-weather-map-chan])]
      (set-inner-html! "alts-output" msg))))
```

<section>
<span>First API to return results: </span>
<span id="alts-output"></span>
</section>
<button id="alts-button">Run Code</button>

---

[alts!][alts-docs] will park until the first channel has a result. Since there is some randomness in the amount of time each API takes to respond in this example, click the button above a few times and we will potentially get results from a different one on multiple runs.

[alts-docs]: https://clojure.github.io/core.async/#clojure.core.async/alts!


<script src="/js/core-async-examples-part-two.js"> </script>

