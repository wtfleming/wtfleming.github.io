---
layout: post
title:  "Adventures with core.async - Part 1 - Channels and Messages"
date:   2015-04-15 18:03:46
tags: clojurescript clojure
---



# Introduction

- In part 1 of this series we will look at the basics of core.async via channels and messages.
- In [part 2][part-2] we explore timeouts and working with multiple channels using examples of calling out to web APIs.

[core.async][core-async] is a Clojure/ClojureScript library to facilitate asynchronous programming using channels.

I wanted to show some simple examples with live demos in the browser using Clojurescript, but if you would like to read a more thorough overview there is a great [overview of core.async at the clojure.com blog][core-blog-post]. Code related to this post is also available at [GitHub][source-code].

It builds upon the [Communicating Sequential Processes (CSP) model][csp-wiki] described by Tony Hoare in the late 1970's, but seems to have seen a resurgence in popularity due to its usage in the Go programming language.


[core-async]: https://github.com/clojure/core.async
[core-blog-post]: http://clojure.com/blog/2013/06/28/clojure-core-async-channels.html
[csp-wiki]: http://en.wikipedia.org/wiki/Communicating_sequential_processes
[source-code]: https://github.com/wtfleming/clojurescript-examples/tree/master/core-async-examples


# Sending Messages

These are some of the functions available for writing to and reading from a channel.

| Function |  |
|----------|--------|
|put!      | Write a message asynchronously to a channel.      |
|take! | Take a message asynchronously from a channel. |
| >!! | Write a message to a channel, blocks if no buffer space is available.|
| <!! | Read a message from a channel, blocks if nothing is available.|
| >! | Write a message to a channel, parks if no buffer space is available. Must be called in a go block. |
| <! | Read a message from a channel, parks if nothing is available. Must be called within a go block. |

Note that >!! and <!! are not available in ClojureScript as the underlying JavaScript runtime is single threaded, and blocking that thread would be undesirable.

# go Blocks

We can use the **go** macro provided by core.async to create new processes. It will turn any channel operations within into a state machine, which parks on a blocking operation, and resumes when the blocking operation completes.

The concept of parking will be covered in more depth in a future post.

# Code

For the sake of completeness here is a helper function to set DOM values in the browser using the [Google Closure Library][closure].

[closure]: https://developers.google.com/closure/library/

```clojure
(defn set-inner-html!
  "Helper function to set contents of a DOM element."
  [elem value]
  (set! (.-innerHTML (goog.dom/getElement elem)) value))
```

We will use in the examples below.


# Unbuffered Channels

The simplest channel is unbuffered and created using the **chan** function with no arguments.

Writing to an unbuffered channel blocks further writes until the message is read by a consumer of the channel. So in this example we must read from and write to the channel in separate go blocks, which will allow them to appear to run concurrently.



```clojure
(defn handle-example-zero-button-click
  "Write to and read from an unbuffered channel."
  [_]
  (let [ch (chan)]
    ;; Write to a channel
    (go
      (>! ch "Hello from an unbuffered channel!"))

    ;; Read from the channel
    (go
      (let [msg (<! ch)]
        (set-inner-html! "example-zero-output" msg)
        (close! ch)))))
```


<section>
<span>Unbuffered channel output: </span>
<span id="example-zero-output"></span>
</section>
<button id="example-zero-button">Run Code</button>

# Buffered Channels

Calling **chan** with a single argument that is a number creates a channel with a buffer. This allows us to write more than one message to the channel before it blocks. In the example below we create a channel with a buffer of 5.

Note that since this is not an unbuffered channel (and we are not writing more messages than the size of the buffer) we do not need to run the reads and writes in separate go blocks.

```clojure
(defn handle-example-one-button-click
  "Write to and read from a buffered channel."
  [_]
  (go
    (let [ch (chan 5)
          _ (>! ch "Hello from a buffered channel!")
          msg (<! ch)]
      (set-inner-html! "example-one-output" msg)
      (close! ch))))
```

<section>
<span>Buffered channel output: </span>
<span id="example-one-output"></span>
</section>
<button id="example-one-button">Run Code</button>

# Dropping Buffers

We can also create a channel with a dropping-buffer. In this case writes will complete when the buffer is full, but the value will be dropped.

We are also using the onto-chan function here, which will write the contents of a collection onto a channel. In this case we are writing the elements of the list (0 1 2 3 4 5 6 7 8 9) to the channel. Note that onto-chan will also close the channel.

We are also using the specialized into function provided by core.async, which returns a channel containing a message consisting of the items in the channel conjoined to the collection passed in.

```clojure
(defn handle-example-two-button-click
  "Write to and read from a channel with a dropping buffer."
  [_]
  (go
    (let [ch (chan (dropping-buffer 5))
          _ (onto-chan ch (range 0 10))
          msg (<! (async/into [] ch))]
      (set-inner-html! "example-two-output" msg))))
```

<section>
<span>Dropping buffer output: </span>
<span id="example-two-output"></span>
</section>
<button id="example-two-button">Run Code</button>

# Sliding Buffers

A sliding-buffer is similar to a dropping-buffer, except that when the buffer is full, writes will continue to succeed but the oldest element in the buffer will be dropped.

```clojure
(defn handle-example-three-button-click
  "Write to and read from to a channel with a sliding buffer."
  [_]
  (go
    (let [ch (chan (sliding-buffer 5))
          _ (onto-chan ch (range 0 10))
          msg (<! (async/into [] ch))]
      (set-inner-html! "example-three-output" msg))))
```

<section>
<span>Sliding buffer output: </span>
<span id="example-three-output"></span>
</section>
<button id="example-three-button">Run Code</button>



# Conclusion

We've barely scratched the surface of core.async in this introductory post. In future posts we'll see more of what the library provides, show some practical examples (including some very neat things we can do with the state machine that go blocks provide).

- In part 1 of this series we looked at the basics of core.async via channels and messages.
- In [part 2][part-2] we will explore timeouts and working with multiple channels using examples of calling out to web APIs.


[part-2]: {% post_url 2015-05-27-adventures-with-core-async-part-two-parking-timeouts-alt %}

<script src="/js/core-async-examples.js"> </script>

