---
layout: post
title:  "Geospatial queries with elasticsearch"
date:   2014-10-24 18:13:46
tags: elasticsearch
---

Recently I was investigating the geospatial capabilities of [elasticsearch][elasticsearch-home] for a project (in this case I am using version 1.3.4). While I ultimately ended up not using it for this project I thought I would write up an example using the command line.

---

# Create a mapping
First we need to create a mapping for the geotest index. A mapping allows us to tell elasticsearch how an index is structured. In this case we expect our documents to have two fields: a user identifier, and a location (in this case we are using a 2 dimensional point to represent lat/lon).

``` sh
curl -XPUT http://localhost:9200/geotest -d '
{
    "mappings": {
        "usergeo": {
            "properties": {
                "udid": {"type": "string"},
                "location": {"type": "geo_point"}
            }
        }
    }
}
'
```

# Add users to the index

``` sh
curl -XPOST 'http://localhost:9200/geotest/usergeo' -d '
{
    "udid" : "foo-udid",
    "location": {"lat": "38.897676", "lon": "-77.03653"}
}
'
curl -XPOST 'http://localhost:9200/geotest/usergeo' -d '
{
    "udid" : "bar-udid",
    "location": {"lat": "28.897676", "lon": "-81.03653"}
}
'
```

# Run a query

Find all users located within a polygon.

``` sh
curl -XGET 'http://localhost:9200/geotest/usergeo/_search?pretty=true' -d '
{
  "query": {
    "filtered" : {
        "query" : {
            "match_all" : {}
        },
       "filter" : {
            "geo_polygon" : {
                "location" : {
                    "points" : [
                        {"lat" : 30, "lon" : -70},
                        {"lat" : 30, "lon" : -80},
                        {"lat" : 40, "lon" : -80},
                        {"lat" : 40, "lon" : -70}
                    ]
                }
            }
        }
    }
  }
}
'
```

You should see output similar to the following. As you can see, elasticsearch only returned the one user that was within the polygon.

``` json
{
  "took" : 4,
  "timed_out" : false,
  "_shards" : {
    "total" : 5,
    "successful" : 5,
    "failed" : 0
  },
  "hits" : {
    "total" : 1,
    "max_score" : 1.0,
    "hits" : [ {
      "_index" : "geotest",
      "_type" : "usergeo",
      "_id" : "_R-YQd-eS-2vc3rBzhibAQ",
      "_score" : 1.0,
      "_source":
{
    "udid" : "foobar-udid",
    "location": {"lat": "38.897676", "lon": "-77.03653"}
}

    } ]
  }
}
```

[elasticsearch-home]: http://www.elasticsearch.org/
