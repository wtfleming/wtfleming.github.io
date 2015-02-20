---
layout: post
title:  "Visualizing Twitter Connections with D3 and ClojureScript"
date:   2015-02-19 18:03:46
tags: clojurescript d3
---

# Introduction

I was curious about the connections between some of the people I follow on Twitter and wanted to try visualizing it using [D3][d3] and ClojureScript using a [force directed graph][force-layout-docs]. The end result looks like this:

[d3]: http://d3js.org/
[force-layout-docs]: https://github.com/mbostock/d3/wiki/Force-Layout

<div class="app"></div>
<script src="/js/d3-force-directed-graph.js"> </script>
<script>
force_directed_graph.core.main('/js/d3-force-directed-graph.json');
</script>


Not a lot of surprises, there are a few clusters around common interests: Emacs, food, Dwarf Fortress, Hadoop, etc.

# Code
In this post i'll just share a minimum of ClojureScript code, but a [code for a full example is available at Github][github-code]. I highly recommend checking out the code, running the commands in the README file, and then viewing the results in a browser.

[github-code]: https://github.com/wtfleming/clojurescript-examples/tree/master/d3-force-directed-graph


```clojure
(ns force-directed-graph.core
  (:require cljsjs.d3))

(defn- build-force-layout [width height]
  (.. js/d3
      -layout
      force
      (charge -140)
      (linkDistance 40)
      (size (array width height))))

(defn- setup-force-layout [force-layout graph]
  (.. force-layout
      (nodes (.-nodes graph))
      (links (.-links graph))
      start))

(defn- build-svg [width height]
  (.. js/d3
      (select ".app")
      (append "svg")
      (attr "width" width)
      (attr "height" height)))

(defn- build-links [svg graph]
  (.. svg
      (selectAll ".link")
      (data (.-links graph))
      enter
      (append "line")
      (attr "class" "link")
      (attr "stroke" "grey")
      (style "stroke-width" 1)))

(defn- build-nodes [svg graph force-layout]
  (.. svg
      (selectAll ".node")
      (data (.-nodes graph))
      enter
      (append "text")
      (attr "cx" 12)
      (attr "cy" ".35em")
      (text #(.-name %))
      (call (.-drag force-layout))))


(defn on-tick [link node]
  (fn []
    (.. link
        (attr "x1" #(.. % -source -x))
        (attr "y1" #(.. % -source -y))
        (attr "x2" #(.. % -target -x))
        (attr "y2" #(.. % -target -y)))
    (.. node
        (attr "transform" #(str "translate(" (.. % -x) "," (.. % -y) ")")))))


(defn ^:export main [json-file]
  (let [width 960
        height 600
        force-layout (build-force-layout width height)
        svg (build-svg width height)]
    (.json js/d3 json-file
           (fn [error json]
             (.. json
                 -links
                 (forEach #(do (aset %1 "weight" 1.0)
                               (aset %1 "index" %2))))
             (setup-force-layout force-layout json)
             (let [links (build-links svg json)
                   nodes (build-nodes svg json force-layout)]
               (.on force-layout "tick"
                    (on-tick links nodes)))))))

```

We are pulling in D3 via [CLJSJS][cljsjs] packages, which makes adding dependencies on Javascript libraries very easy. Otherwise, it is all pretty straightforward and not too different from an [example like this in Javascript][javascript-example].

[cljsjs]: http://cljsjs.github.io/
[javascript-example]: http://bl.ocks.org/mbostock/4062045

# Sample input

The one thing to be aware of is how the JSON that will be passed in needs to be formatted. You will need to define nodes and links between the nodes.

Here is a simple example with four nodes, in this case the node named A follows B and C, while B follows D.

```json
{
  "nodes": [
    {
      "name": "A",
      "index": 0
    },
    {
      "name": "B",
      "index": 1
    },
    {
      "name": "C",
      "index": 2
    },
    {
      "name": "D",
      "index": 3
    }
  ],
    "links": [
    {
      "target": 1,
      "source": 0
    },
    {
      "target": 2,
      "source": 0
    },
    {
      "target": 3,
      "source": 1
    }
  ]
}
```
