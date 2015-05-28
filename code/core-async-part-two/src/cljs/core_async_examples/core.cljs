(ns core-async-examples.core
  (:require-macros [cljs.core.async.macros :refer [go]])
  (:require [goog.events :as events]
            [goog.events.EventType :as EventType]
            [goog.dom :as dom]
            [cljs.core.async
             :as async
             :refer [>! <! chan timeout]]))
;             :refer [>! <! chan dropping-buffer sliding-buffer onto-chan close!]]))


(defn set-inner-html!
  "Helper function to set contents of a DOM element."
  [elem value]
  (set! (.-innerHTML (dom/getElement elem)) value))



(defn- mock-api-call
  "Takes a time to wait in milliseconds and a message. Returns a channel containing the message"
  [ms msg]
  (go
    (<! (timeout ms))
    msg))


(defn- weather-underground-api-call []
  (mock-api-call (rand-int 1500) "Weather Underground responded."))

(defn- open-weather-map-api-call []
  (mock-api-call (rand-int 1500) "OpenWeatherMap responded."))

;; alt! should show example?
;; alts!
(defn handle-alts-button-click
  "Call two APIs. Output results from the first to return."
  [_]
  (set-inner-html! "alts-output" "Calling APIs, waiting for results.")
  (go
    (let [weather-underground-chan (weather-underground-api-call)
          open-weather-map-chan (open-weather-map-api-call)
          [msg] (alts!
                 [weather-underground-chan
                  open-weather-map-chan])]
      (set-inner-html! "alts-output" msg))))


;; Sleep/Timeout
(defn handle-timeout-button-click
  "Example of timeouts."
  [_]
  (set-inner-html! "timeout-output" "Button clicked, waiting...")
  (go
    (<! (async/timeout 1000))
    (set-inner-html! "timeout-output" "Finished after waiting 1 second.")))


;; Parking
(defn handle-parking-button-click
  "Call two APIs. Output results from both."
  [_]
  (set-inner-html! "parking-output" "Calling APIs, waiting for results.")
  (go
    (let [weather-underground-chan (weather-underground-api-call)
          open-weather-map-chan (open-weather-map-api-call)
          weather-underground-message (<! weather-underground-chan)
          open-weather-map-message (<! open-weather-map-chan)
          msg (str weather-underground-message " " open-weather-map-message)]
      (set-inner-html! "parking-output" msg))))




(defn set-click-handler
  "Helper function to setting click event handlers."
  [btn-element handler-fn]
  (let [btn (dom/getElement btn-element)]
    (events/listen btn EventType/CLICK (fn [e] (handler-fn e)))))


(defn main []
    (set-click-handler "alts-button" handle-alts-button-click)
    (set-click-handler "timeout-button" handle-timeout-button-click)
    (set-click-handler "parking-button" handle-parking-button-click))


(main)
