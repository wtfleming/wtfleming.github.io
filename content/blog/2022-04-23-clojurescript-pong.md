+++
title = "Pong in ClojureScript"
[taxonomies]
tags = [ "clojure", "clojurescript" ]
+++
 
<button id="button">Click to start!</button>
<canvas id="canvas" width="700" height="500" style="background-color: #F8F8FF;"></canvas>

<script src="/js/pong-cljs.js"> </script>

I'm working predominantly with Clojure at work these days, but I wanted to spend some time with ClojureScript, so I figured making a pong clone would be a fun weekend project.

- Every time the ball hits a paddle it increases in speed and it's direction is set to a randomized unit vector.
- Player two moves up or down depending on if the ball it above or below it
- Player one behaves the same when the ball is moving towards it, otherwise it moves to the middle of the screen.

The code is [available on GitHub](https://github.com/wtfleming/pong-cljs)

