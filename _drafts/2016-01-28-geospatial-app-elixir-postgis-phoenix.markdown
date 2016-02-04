---
layout: post
title:  "Geospatial website in Elixir with PostGIS and Phoenix"
date:   2016-01-28 14:05:46
tags: erlang elixir
---


TODO use a newer version of phoenix
TODO http://bl.ocks.org/zunayed/9081453 D3 world map plus animation


Data from https://www.kaggle.com/kaggle/climate-data-from-ocean-ships

Saw code at https://www.kaggle.com/katacs/d/kaggle/climate-data-from-ocean-ships/captain-cook-s-travels/code

You will need to create a kaggle account to download

TODO - MAYBE move this to the end, with a note here that a fix is documented later in the post?
Unfortunately the Elixir CSV parser we are using is not RFC 4180 compliant  https://github.com/beatrichartz/csv/issues/13 and the data includes fields with escaped newlines.
Until this is fixed I removed the newlines with the following python script

ADD PYTHON SCRIPT


# Docker

```sh
# Create a persistent data volume
$ sudo docker create -v /var/lib/postgresql/data \
    --name postgres-ocean-ships-data busybox

# Create the postgis container
$ sudo docker run --name postgres-ocean-ships -p 5432:5432 \
    -e POSTGRES_PASSWORD=postgres -d --volumes-from postgres-ocean-ships-data \
    mdillon/postgis:9.4
```

Make sure you can connect to Postgres

```sh
$ psql -h localhost -p 5432 -U postgres
```

If you don't have psql installed locally you can also use the one in the container and connect like this:

```sh
$ sudo docker exec -i -t postgres-ocean-ships bash
root@10499abd059e:/# psql -h localhost -p 5432 -U postgres
```


In the future you can now start and stop the Postgres container like this:

```sh
$ sudo docker start postgres-ocean-ships
$ sudo docker stop postgres-ocean-ships
```

# Phoenix

Create the Phoenix app

```sh
$ mix phoenix.new ocean_ship_logbooks
$ cd ocean_ship_logbooks/
$ mix ecto.create
```

Add each of these to your mix.exs dependencies

```
{:csv, "~> 1.2.3"}
{:geo, "~> 1.0"}
```

Fetch them

```sh
$ mix deps.get
```


Add to your config files
```
  extensions: [{Geo.PostGIS.Extension, library: Geo}]
```


# Create database migrations


Enable postgis

```sh
$ mix ecto.gen.migration enable_postgis
* creating priv/repo/migrations
* creating priv/repo/migrations/20160128183445_enable_postgis.exs
```

Edit 20160128183445\_enable\_postgis.exs so that the contents are this:

```elixir
defmodule OceanShipLogbooks.Repo.Migrations.EnablePostgis do
  use Ecto.Migration

  def up do
    execute "CREATE EXTENSION IF NOT EXISTS postgis"
  end

  def down do
    execute "DROP EXTENSION IF EXISTS postgis"
  end

end
```

Create ship data table

Since the ship data will be accessed via a JSON API, you normally might generate a resource with the mix [phoenix.gen.json][mix-json] task to create the model, migration, view, etc. code, but since we are using custom geo types from PostGIS. So we'll just create them manually.

[mix-json]: http://hexdocs.pm/phoenix/Mix.Tasks.Phoenix.Gen.Json.html


```sh
$ mix ecto.gen.migration create_ship_data
* creating priv/repo/migrations
* creating priv/repo/migrations/20160128223253_create_ship_data.exs
```

Alter the file so that it has the following contents:

```elixir
defmodule OceanShipLogbooks.Repo.Migrations.CreateShipData do
  use Ecto.Migration

  def change do
    create table(:ship_data) do
      add :ship,     :string
      add :utc,      :integer
      add :geom,     :geometry
    end
    create index(:ship_data, [:ship])
  end

end
```



Now lets run the migrations.

```sh
$ mix ecto.migrate
```

# Changeset View

Let's return a JSON response when there is an error. Create a file named web/views/changeset_view.ex with the following contents:

```elixir
defmodule OceanShipLogbooks.ChangesetView do
  use OceanShipLogbooks.Web, :view

  def render("error.json", %{changeset: changeset}) do
    # When encoded, the changeset returns its errors
    # as a JSON object. So we just pass it forward.
    %{errors: changeset}
  end
end
```


# Ship Data View

Create a file web/views/ship_data_view.ex with these contents:

```elixir

```

# Ship Data Controller

Create a file web/controllers/ship_data_controller.ex with these contents:

```elixir

```


# Router

Look in web/router.ex for the following


```elixir
# Other scopes may use custom stacks.
# scope "/api", OceanShipLogbooks do
#   pipe_through :api
# end
```

**FIXME UPDATE ROUTER CODE**

Uncomment the block and change it to look like this:

```elixir
# Other scopes may use custom stacks.
scope "/api", OceanShipLogbooks do
  pipe_through :api
  resources "/ship_data", ShipDataController, only: [:index]
end
```


# D3

Geojson data from http://emeeks.github.io/d3ia/world.geojson

Put the world.geojson file at
priv/static/js/world.geojson


http://localhost:4000/js/world.geojson




# HTML

Edit web/templates/page/index.html.eex to look like this:

```html
<div class="jumbotron">
  <h2>Captain Cook's travels</h2>
</div>

<div id="d3_map"></div> 

<script src="//d3js.org/d3.v3.min.js" charset="utf-8"></script>

<script>
  var shipData;
  var width = 500;
  var height = 500;
  var projection = d3.geo.mercator()
    .scale(80)
    .translate([width / 2, height / 2]);

  var svg = d3.select("#d3_map")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  
  d3.json("/js/world.geojson", createMap);

  function createMap(countries) {
    var geoPath = d3.geo.path().projection(projection);
    d3.select("svg").selectAll("path").data(countries.features)
      .enter()
      .append("path")
      .attr("d", geoPath)
      .attr("class", "countries");
  };

  function makeRequest(url) {
    httpRequest = new XMLHttpRequest();
    if (!httpRequest) {
      console.log('Cannot create an XMLHTTP instance');
      return false;
    }
    httpRequest.onreadystatechange = jsonContents;
    httpRequest.open('GET', url);
    httpRequest.send();
  }

  function jsonContents() {
    if (httpRequest.readyState === XMLHttpRequest.DONE) {
      if (httpRequest.status === 200) {
        var response = JSON.parse(httpRequest.responseText);
        shipData = response.ship_data;
        drawCircle(shipData.slice(0));
      } else {
        console.log('There was a problem with the request.');
      }
    }
  }

  
  function drawCircle(shipDataCopy) {
    // if no data, erase the circles from the map and start over
    if (shipDataCopy.length == 0) {
      svg.selectAll("circle").remove();
      setTimeout(function() { drawCircle(shipData.slice(0))}, 50);
      return;
    }

    shipDatum = shipDataCopy.shift();

    d3.select("svg")
      .append("circle")
      .style("fill", "red")
      .attr("r", 2)
      .attr("cx", function(d) {return projection([shipDatum.lon,shipDatum.lat])[0]})
      .attr("cy", function(d) {return projection([shipDatum.lon,shipDatum.lat])[1]});

    setTimeout(function() { drawCircle(shipDataCopy) }, 50);
 }

makeRequest("/api/ship_data");

</script>
```
