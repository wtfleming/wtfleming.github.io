---
layout: post
title:  "Getting started with OpenGL in Elixir"
date:   2016-01-06 14:05:46
tags: erlang elxir
---

I was curious about using OpenGL with Elixir and couldn't find much very information. Other than a kludge for working with constants defined in Erlang .hrl files it turned out to be not too difficult.


The final result draws a triangle on the screen and looks like this:

![OpenGL Triangle]({{ site.url }}images/elixir-opengl-01/triangle.png)

# wxWidgets and Erlang

Erlang/OTP ships with a port of [wxWidgets][wx], so creating a window and obtaining an OpenGL context is relatively easy.

[wx]: http://www.erlang.org/doc/man/wx.html


To see some examples and the associated Erlang code start iex and run the following command:

```elixir
iex(1)> :wx.demo
```

A window that looks something like this should appear.

![wxErlang]({{ site.url }}images/elixir-opengl-01/wxerlang.png)

Next we want to do something similar, but in Elixir instead.


# Create an Elixir project

Run these commands in a shell

```sh
$ mix new elixir_opengl
$ cd elixir_opengl

# To make this work we are also going to need to create a couple Erlang source files
$ mkdir src
```

# Erlang modules

If you look inside your Erlang/OTP distribution directory at the file lib/wx/include/wx.hrl you will see a number of defines that look like:

```erlang
-define(wxID_ANY, -1).
```

I found [this discussion][erlang-header-discussion] about how to access them from Elixir - create an Erlang module with functions that return the value. You can then reference it from Elixir with a function call like this:

```elixir
:wx_const.wx_id_any()
```

[erlang-header-discussion]: https://groups.google.com/forum/#!topic/elixir-lang-talk/VbGTz7rKebM

Now create an Erlang file named src/wx_const.erl with the following contents:

```erlang
-module(wx_const).
-compile(export_all).

-include_lib("wx/include/wx.hrl").

wx_id_any() ->
  ?wxID_ANY.

wx_sunken_border() ->
  ?wxSUNKEN_BORDER.

wx_gl_rgba() ->
  ?WX_GL_RGBA.

wx_gl_doublebuffer() ->
 ?WX_GL_DOUBLEBUFFER.

wx_gl_min_red() ->
  ?WX_GL_MIN_RED.

wx_gl_min_green() ->
  ?WX_GL_MIN_GREEN.

wx_gl_min_blue() ->
  ?WX_GL_MIN_BLUE.
  
wx_gl_depth_size() ->
  ?WX_GL_DEPTH_SIZE.
```

Next create a file src/gl_const.erl with these contents:

```erlang
-module(gl_const).
-compile(export_all).

-include_lib("wx/include/gl.hrl").

gl_smooth() ->
  ?GL_SMOOTH.

gl_depth_test() ->
  ?GL_DEPTH_TEST.

gl_lequal() ->
  ?GL_LEQUAL.

gl_perspective_correction_hint() ->
  ?GL_PERSPECTIVE_CORRECTION_HINT.

gl_nicest() ->
  ?GL_NICEST.

gl_color_buffer_bit() ->
  ?GL_COLOR_BUFFER_BIT.

gl_depth_buffer_bit() ->
  ?GL_DEPTH_BUFFER_BIT.

gl_triangles() ->
  ?GL_TRIANGLES.

gl_projection() ->
  ?GL_PROJECTION.

gl_modelview() ->
  ?GL_MODELVIEW.

```

We're now done with Erlang.

# Elixir Code

Change lib/elixir_opengl.ex to look like this:

```elixir
defmodule ElixirOpengl do
  @behaviour :wx_object
  use Bitwise

  @title 'Elixir OpenGL'
  @size {600, 600}

  #######
  # API #
  #######
  def start_link() do
    :wx_object.start_link(__MODULE__, [], [])
  end

  #################################
  # :wx_object behavior callbacks #
  #################################
  def init(config) do
    wx = :wx.new(config)
    frame = :wxFrame.new(wx, :wx_const.wx_id_any, @title, [{:size, @size}])
    :wxWindow.connect(frame, :close_window)
    :wxFrame.show(frame)

    opts = [{:size, @size}]
    gl_attrib = [{:attribList, [:wx_const.wx_gl_rgba,
                                :wx_const.wx_gl_doublebuffer,
                                :wx_const.wx_gl_min_red, 8,
                                :wx_const.wx_gl_min_green, 8,
                                :wx_const.wx_gl_min_blue, 8,
                                :wx_const.wx_gl_depth_size, 24, 0]}]
    canvas = :wxGLCanvas.new(frame, opts ++ gl_attrib)

    :wxGLCanvas.connect(canvas, :size)
    :wxWindow.reparent(canvas, frame)
    :wxGLCanvas.setCurrent(canvas)
    setup_gl(canvas)

    # Periodically send a message to trigger a redraw of the scene
    timer = :timer.send_interval(20, self(), :update)

    {frame, %{canvas: canvas, timer: timer}}
  end

  def code_change(_, _, state) do
    {:stop, :not_implemented, state}
  end

  def handle_cast(msg, state) do
    IO.puts "Cast:"
    IO.inspect msg
    {:noreply, state}
  end

  def handle_call(msg, _from, state) do
    IO.puts "Call:"
    IO.inspect msg
    {:reply, :ok, state}
  end

  def handle_info(:stop, state) do
    :timer.cancel(state.timer)
    :wxGLCanvas.destroy(state.canvas)
    {:stop, :normal, state}
  end

  def handle_info(:update, state) do
    :wx.batch(fn -> render(state) end)
    {:noreply, state}
  end

  # Example input:
  # {:wx, -2006, {:wx_ref, 35, :wxFrame, []}, [], {:wxClose, :close_window}}
  def handle_event({:wx, _, _, _, {:wxClose, :close_window}}, state) do
    {:stop, :normal, state}
  end

  def handle_event({:wx, _, _, _, {:wxSize, :size, {width, height}, _}}, state) do
    if width != 0 and height != 0 do
      resize_gl_scene(width, height)
    end
    {:noreply, state}
  end

  def terminate(_reason, state) do
    :wxGLCanvas.destroy(state.canvas)
    :timer.cancel(state.timer)
    :timer.sleep(300)
  end


  #####################
  # Private Functions #
  #####################
  defp setup_gl(win) do
    {w, h} = :wxWindow.getClientSize(win)
    resize_gl_scene(w, h)
    :gl.shadeModel(:gl_const.gl_smooth)
    :gl.clearColor(0.0, 0.0, 0.0, 0.0)
    :gl.clearDepth(1.0)
    :gl.enable(:gl_const.gl_depth_test)
    :gl.depthFunc(:gl_const.gl_lequal)
    :gl.hint(:gl_const.gl_perspective_correction_hint, :gl_const.gl_nicest)
    :ok
  end

  defp resize_gl_scene(width, height) do
    :gl.viewport(0, 0, width, height)
    :gl.matrixMode(:gl_const.gl_projection)
    :gl.loadIdentity()
    :glu.perspective(45.0, width / height, 0.1, 100.0)
    :gl.matrixMode(:gl_const.gl_modelview)
    :gl.loadIdentity()
    :ok
  end

  defp draw() do
    :gl.clear(Bitwise.bor(:gl_const.gl_color_buffer_bit, :gl_const.gl_depth_buffer_bit))
    :gl.loadIdentity()
    :gl.translatef(-1.5, 0.0, -6.0)
    :gl.'begin'(:gl_const.gl_triangles)
    :gl.vertex3f(0.0, 1.0, 0.0)
    :gl.vertex3f(-1.0, -1.0, 0.0)
    :gl.vertex3f(1.0, -1.0, 0.0)
    :gl.'end'()
    :ok
  end

  defp render(%{canvas: canvas} = _state) do
    draw()
    :wxGLCanvas.swapBuffers(canvas)
    :ok
  end
end
```

Now lets run the program, start iex like this:

```sh
$ iex -S mix
```

And run this command

```elixir
iex(1)> ElixirOpengl.start_link
```

A window should appear that looks like this:

![OpenGL Triangle]({{ site.url }}images/elixir-opengl-01/triangle.png)

I suspect this can be improved on, but we've got an OpenGL context which is good enough for now.
