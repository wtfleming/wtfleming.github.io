+++
title = "Ray Tracing in the Browser using ReasonML"
[taxonomies]
tags = [ "reasonml" ]
+++


![image](/images/raytracing-reason/raytracing1.png)

I was reading Peter Shirley's little book [Ray Tracing in One Weekend](http://in1weekend.blogspot.com/2016/01/ray-tracing-in-one-weekend.html) which provides code in C and for fun wanted to try to implement it in [Reason](https://reasonml.github.io/). Source code is [available here](https://github.com/wtfleming/reason-examples/tree/master/ray-tracer).

Above is a pregenerated image, but you can click the button below to generate a smaller lower quality picture on demand (it takes about 5 seconds to generate on my laptop).

<button id="calculate">Click Me And Lets Do Some Ray Tracing In The Browser</button>
<br />
<canvas id="demo" width="200" height="100"></canvas>

I can't think of many reasons you'd want to do ray tracing in JavaScript, but for now this was a fun little weekend project.

<script src="/js/reason-raytracer/Main.bs.695be687.js" charset="utf-8"></script>
