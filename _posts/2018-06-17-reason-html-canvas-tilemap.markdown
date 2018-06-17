---
layout: post
title:  "Drawing Tilemaps on an HTML Canvas with Reason"
date:   2018-06-17 14:05:46
tags: reason reasonml
---

<script src="/js/reason-canvas-tilemap-1/App.bs.js" charset="utf-8"> </script>

I was curious about using [Reason](https://reasonml.github.io/) to draw 2D tilemaps in the browser using a [Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API) element. If you need an overview of tiles, tilemaps, etc. there is a great introduction over at [developer.mozilla.org](https://developer.mozilla.org/en-US/docs/Games/Techniques/Tilemaps).

We will end up drawing this level of what could be a roguelike game, with an adventurer, monsters, and treasure chests:

<canvas id="demo" width="256" height="256"></canvas>

A full project with the source code is [available here](https://github.com/wtfleming/reason-examples/tree/master/bs-canvas-tilemap).

# Sprites

We will be using a sprite atlas modified from [this Angband tileset](http://files.sablab.net/Games/Angband/Angband/lib/xtra/graf/16x16.bmp) with a permissive [license](http://angband.oook.cz/forum/showpost.php?p=316&postcount=16). It looks like this:

![Sprite Atlas]({{ "/images/reason-canvas-tilemap-1/tiles16.png" | absolute_url}})

The level data is stored in a list, each number represents the index of the sprite atlas to use when drawing that tile.

```ocaml
     let tiles = [ 
          2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 
          2, 1, 1, 1, 1, 2, 5, 1, 1, 1, 1, 1, 1, 1, 1, 2, 
          2, 1, 1, 1, 1, 2, 1, 1, 1, 2, 2, 2, 2, 2, 1, 2, 
          2, 1, 1, 4, 1, 2, 2, 2, 2, 2, 0, 0, 0, 2, 1, 2,
          2, 1, 1, 1, 1, 2, 0, 0, 0, 0, 0, 0, 0, 2, 1, 2, 
          2, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 
          2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 
          0, 2, 1, 1, 1, 2, 1, 2, 2, 1, 1, 1, 1, 1, 1, 2, 
          0, 2, 2, 2, 2, 2, 1, 2, 2, 2, 1, 1, 3, 1, 1, 2, 
          0, 2, 1, 1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 2, 
          0, 2, 1, 3, 1, 1, 1, 1, 2, 2, 2, 2, 2, 1, 2, 2, 
          0, 2, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 1, 2, 2, 
          0, 2, 2, 1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 2, 
          0, 0, 2, 1, 1, 3, 1, 1, 2, 1, 1, 1, 1, 5, 1, 2, 
          0, 0, 2, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 2, 
          0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2 
        ];
```

# Working with the DOM
Reason (and [BuckleScript](https://bucklescript.github.io/)) allows us to write type safe code to work with the browser DOM, but we will need to write some code for the interop. You could just use `bs.raw` and use [JavaScript directly](https://reasonml.github.io/docs/en/interop.html), but doing it this way will provide some type safety and let you catch some errors at compile time instead of runtime.


*Note*: If you need to work with the DOM you should use the excellent [bs-webapi](https://github.com/reasonml-community/bs-webapi-incubator) library instead. The code below is just something I used for learning Reason/JavaScript interop.


```ocaml
module Window = {
  type t;
  [@bs.val] external t : t = "window";

  [@bs.send]
  external addEventListener : (t, string, unit => unit) => unit =
    "addEventListener";
};

module Document = {
  type t;
  [@bs.val] external t : t = "document";
};

module HtmlImageElement = {
  type t;
  [@bs.new] external make : unit => t = "Image";

  [@bs.set] external setSrc : (t, string) => unit = "src";

  [@bs.send]
  external addEventListener : (t, string, unit => unit) => unit =
    "addEventListener";

  /* Create a html <img> element, and return a promise that resolves when the */
  /* image has finished loading. */
  let loadFromSrc = imageSrc => {
    let imageEl = make();

    let loadImagePromise =
      Js.Promise.make((~resolve, ~reject) => {
        addEventListener(imageEl, "load", () => resolve(. imageEl));
        addEventListener(imageEl, "error", () =>
          reject(. Invalid_argument("Could not load image: " ++ imageSrc))
        );
      });

    setSrc(imageEl, imageSrc);
    loadImagePromise;
  };
};

module Canvas = {
  type t;
  [@bs.send]
  external getElementById : (Document.t, string) => t = "getElementById";
};

module Context = {
  type t;

  /* JavaScript equivalent: canvas.getContext('2d'); */
  [@bs.send]
  external getContext2d : (Canvas.t, [@bs.as "2d"] _) => t = "getContext";

  [@bs.send]
  external drawImage :
    (
      t,
      ~image: HtmlImageElement.t,
      ~dx: int,
      ~dy: int,
      ~dWidth: int,
      ~dHeight: int,
      ~sx: int,
      ~sy: int,
      ~sWidth: int,
      ~sHeight: int
    ) =>
    unit =
    "drawImage";
};
```

# SpriteAtlas

The sprite atlas is an image with all the sprites in it, it looks like:

![Sprite Atlas]({{ "/images/reason-canvas-tilemap-1/tiles16.png" | absolute_url}})

This code allows us to load the atlas into memory and draw one of the sprites into the context.

```ocaml
module SpriteAtlas = {
  type t = {
    imageElement: HtmlImageElement.t,
    spriteWidth: int,
  };

  let make = (src: string, spriteWidth: int) =>
    HtmlImageElement.loadFromSrc(src)
    |> Js.Promise.then_(imageElement =>
         Js.Promise.resolve({imageElement, spriteWidth})
       );

  let drawSprite = (~atlas: t, ~ctx, ~atlasNumber, ~x, ~y) =>
    Context.drawImage(
      ctx,
      ~image=atlas.imageElement,
      ~dx=atlasNumber * atlas.spriteWidth,
      ~dy=0, /*  In this code we only support atlases with a single row of images */
      ~dWidth=atlas.spriteWidth,
      ~dHeight=atlas.spriteWidth,
      ~sx=x,
      ~sy=y,
      ~sWidth=atlas.spriteWidth,
      ~sHeight=atlas.spriteWidth,
    );
};
```

# Tilemap

The tilemap describes what our level looks like, it has a reference to a sprite atlas and a number of rows and columns representing what to draw in the level.

```ocaml
module TileMap = {
  type t = {
    atlas: SpriteAtlas.t,
    numRows: int,
    numCols: int,
    tileSize: int, /* pixels */
    tiles: list(int) /* Maybe should be an array so it is mutable? */
  };

  let make = (~atlas, ~numRows, ~numCols, ~tileSize, ~tiles) => {
    atlas,
    numRows,
    numCols,
    tileSize,
    tiles,
  };

  /* Given an index in a tilemap, get the row and column as if it was a 2D array */
  let getRowAndColumn = (idx: int, tilemap: t) : (int, int) => {
    let col: int = idx mod tilemap.numCols;
    let row: int =
      Js.Math.floor(float_of_int(idx) /. float_of_int(tilemap.numCols));
    (row, col);
  };

  let render = (ctx: Context.t, tilemap: t) =>
    List.iteri(
      (i, num) => {
        let (row, col) = getRowAndColumn(i, tilemap);
        SpriteAtlas.drawSprite(
          ~atlas=tilemap.atlas,
          ~ctx,
          ~atlasNumber=num,
          ~x=col * tilemap.tileSize,
          ~y=row * tilemap.tileSize,
        );
      },
      tilemap.tiles,
    );
};
```

# Drawing the tilemap

Here we do the actual work. Setup the canvas, load the sprites, create a tilemap, then render it in the browser.

```ocaml
let doWindowOnload = () => {
  let canvas: Canvas.t = Canvas.getElementById(Document.t, "demo");
  let ctx: Context.t = Context.getContext2d(canvas);
  SpriteAtlas.make("./tiles16.png", 16)
  |> Js.Promise.then_(atlas => {
     let tiles = [ 
          2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 
          2, 1, 1, 1, 1, 2, 5, 1, 1, 1, 1, 1, 1, 1, 1, 2, 
          2, 1, 1, 1, 1, 2, 1, 1, 1, 2, 2, 2, 2, 2, 1, 2, 
          2, 1, 1, 4, 1, 2, 2, 2, 2, 2, 0, 0, 0, 2, 1, 2,
          2, 1, 1, 1, 1, 2, 0, 0, 0, 0, 0, 0, 0, 2, 1, 2, 
          2, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 
          2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 
          0, 2, 1, 1, 1, 2, 1, 2, 2, 1, 1, 1, 1, 1, 1, 2, 
          0, 2, 2, 2, 2, 2, 1, 2, 2, 2, 1, 1, 3, 1, 1, 2, 
          0, 2, 1, 1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 2, 
          0, 2, 1, 3, 1, 1, 1, 1, 2, 2, 2, 2, 2, 1, 2, 2, 
          0, 2, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 1, 2, 2, 
          0, 2, 2, 1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 2, 
          0, 0, 2, 1, 1, 3, 1, 1, 2, 1, 1, 1, 1, 5, 1, 2, 
          0, 0, 2, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 2, 
          0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2 
        ]; 

       let tilemap = 
         TileMap.make(~atlas, ~numRows=16, ~numCols=16, ~tileSize=16, ~tiles);

       TileMap.render(ctx, tilemap);

       Js.Promise.resolve();
     })
  |> Js.Promise.catch(err => {
       Js.log2("Failure!", err);
       Js.Promise.resolve();
     })
  |> ignore;
};

Window.addEventListener(Window.t, "load", doWindowOnload);
```
