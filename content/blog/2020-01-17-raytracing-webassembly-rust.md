+++
title = "Ray Tracing with Rust and WebAssembly"
[taxonomies]
tags = [ "rust", "webassembly" ]
+++

![Sprite Atlas](/images/rust-raytracer-1/example.png)


I have been working through the book [The Ray Tracer Challenge: A Test-Driven Guide to Your First 3D Renderer](https://pragprog.com/book/jbtracer/the-ray-tracer-challenge) by Jamis Buck. It is a fantastic book, there is almost no code (other than a little bit of pseudocode), instead there is an explanation of how to build a [Whitted ray tracer](https://en.wikipedia.org/wiki/Ray_tracing_(graphics)#Recursive_ray_tracing_algorithm) and a large number of unit tests to walk you through implementing it yourself.

I decided to try to implement the ray tracer in Rust and compile to both a native app and [WebAssembly](https://webassembly.org/). Source code is [available at GitHub](https://github.com/wtfleming/rust-ray-tracer). Currently i've worked through chapter 9 (of 17) so there are a number of features my implementation is missing (and I haven't done any optimization yet).

Unsurprisingly the native app is much faster (by about an order of magnitude by my very unscientific measurements), but I was quite pleased how easy it was to generate the WebAssembly code using Rust.

Above is a pregenerated image, but you can click the button below to generate a smaller lower quality picture on demand. I am using [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers) to do the rendering calculations in multiple threads (each Web Worker runs some WebAssembly).

If you are using Safari there is an issue with `window.navigator.hardwareConcurrency` and this app will default to a single thread. Try in a browser like Firefox or Chrome to see better performance.

<button id="raytracer-button">Click to Render with Web Workers and WebAssembly</button>
<canvas id="raytracer-canvas" width="350" height="250"></canvas>

I have been quite impressed with the Rust tooling and how easy it was to generate a WebAssembly app in the browser. I'm now intrigued with the idea of being able to write WebAssembly modules in languages like C/C++/Rust/Go etc which can interop with each other, and then have the ability to write a smallish frontend in JavaScript or Python (using something like the [Wasmtime](https://wasmtime.dev/) package) to glue it all together.

<script src="/js/rust-raytracer-1/index.js"></script>
