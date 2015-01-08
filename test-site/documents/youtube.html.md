---
layout: default.html.ejs
title: Youtube
foo: bar
---



* Climate
* Change
* is
* Real

<!-- -->
<youtube-video url="http://www.youtube.com/watch?v=kOjCcL1PN_Y" template="youtube.html.ejs"></youtube-video>

{ oembed({
    url: "http://www.youtube.com/watch?v=kOjCcL1PN_Y",
    template: "youtube.html.ejs"
    }) }

