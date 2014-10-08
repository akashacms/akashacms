# Overlay.js

Basic overlay module written for easy customization.

## Dependencies

- jQuery or Zepto

## How to use

```javascript
var instance = new Overlay(el, settings);
// both params are optional.
// if no element given, it makes a new one
// and appends it to the body element.

instance.show(content_key); // content_key equals to "default" when none is passed
```

```html
<link rel="stylesheet" href="overlay.css" />
```

```javascript
// how to add content to the overlay
// -- content can be an element, html or anything else the 'append' function from jQuery accepts
instance.append_content(content);

// hiding the overlay
instance.hide();

// running a callback after the overlay is shown (same for hide and pre_hide)
$(window).on("overlay.show.CONTENT_KEY", callback);

// extra's
// 1. A keydown event is bound to the ESC button when creating a new overlay instance
// 2. A delegated event is bound to the overlay element.
//    When you click on an element with the class name 'close',
//    the overlay closes (+ event.preventDefault())
```

## Settings

```javascript
// with defaults
class_name = "mod-overlay";
background_class_name = "mod-overlay-background";
content_class_name = "overlay-content";

is_shown_class = "visible";
default_content_key = "default";
show_hide_callback_wait_duration = 750;
render_templates_for_predefined_elements = true;

// functions that return html
template_function = default_template_function;
background_template_function = default_background_template_function;
```

## Install

```
bower install overlay-js
```
