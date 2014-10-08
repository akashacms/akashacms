/*

    OVERLAY JS
    v0.2.1

*/

(function($) {

"use strict";

var __bind = function(fn, me) {
  return function() { return fn.apply(me, arguments); };
};

var default_template_function = function() {
  return [
    '<div class="overlay-outer-wrapper">',
      '<div class="overlay-inner-wrapper">',
        '<div class="overlay-close-layer close"></div>',
        '<div class="overlay-content">',
          '<div class="overlay-header">',
            '<a href="#" class="close"></a>',
          '</div>',
        '</div>',
      '</div>',
    '</div>'
  ].join('');
};

var default_background_template_function = function() {
  return [
    ''
  ].join('');
};


//
//  Default settings
//
Overlay.prototype.settings = {
  class_name: "mod-overlay",
  background_class_name: "mod-overlay-background",
  content_class_name: "overlay-content",

  is_shown_class: "visible",
  default_content_key: "default",
  show_hide_callback_wait_duration: 750,
  // e.g. 0 = execute immediately after the 'show' function is called
  // does not apply to browsers that don't support transitions

  render_templates_for_predefined_elements: true,
  template_function: default_template_function,
  background_template_function: default_background_template_function
};



//
//  Constructor
//  -> and main setup
//
function Overlay(el, settings) {
  //
  // instance variables:
  // el, $el, bg, $bg,
  // $content, state

  this.bind_some_methods_to_self();
  this.set_initial_state_object();
  this.set_initial_settings_object(settings);
  this.create_new_or_use_element(el);
  this.bind_events();
}



//
//  Create new or use element
//
//  -> If an element is given, set that element as
//     the main element and find the associated background element.
//
//     If not, make new elements and append them to the body element.
//
//     And also cache some other elements.
//
Overlay.prototype.create_new_or_use_element = function(element) {
  var predefined = !!element;
  var background;

  // main element
  if (!predefined) {
    element = document.createElement("div");
    element.className = this.settings.class_name;
    element.innerHTML = this.settings.template_function();

  } else if (this.settings.render_templates_for_predefined_elements) {
    element.innerHTML = this.settings.template_function();

  }

  this.el = element;
  this.$el = $(this.el);

  // background
  if (!predefined) {
    background = document.createElement("div");
    background.className = this.settings.background_class_name;
    background.innerHTML = this.settings.background_template_function();

  } else {
    background = this.$el.siblings("." + this.settings.background_class_name).get(0);

    if (this.settings.render_templates_for_predefined_elements) {
      background.innerHTML = this.settings.background_template_function();
    }

  }

  this.bg = background;
  this.$bg = $(this.bg);

  // add to dom if needed
  if (!predefined) {
    document.body.appendChild(element);
    document.body.appendChild(background);
  }

  // cache other elements
  this.cache_other_elements();
};


Overlay.prototype.cache_other_elements = function() {
  this.$content = this.$el.find("." + this.settings.content_class_name);
};



//
//  Show + callback
//
//  -> Shows the main element and background by
//     setting 'display: block', then adds the
//     is_shown class to those elements and then
//     calls the callback on transitionend (if supported).
//
//     The reason for the setTimeout usage is that, for example.
//     If you set the following at the same time,
//     'display: block' and 'opacity: 1' along with
//     a transition for opacity. Then the transition won't work,
//     for reasons unknown.
//
Overlay.prototype.show = function(content_key) {
  var that = this;

  // content key
  content_key = content_key || this.settings.default_content_key;

  // show
  setTimeout(function() {
    that.$el.add(that.$bg).css("display", "block");
  }, 0);

  // main
  setTimeout(function() {
    that.$el.add(that.$bg)
      .addClass(that.settings.is_shown_class)
      .addClass(content_key);
  }, 25);

  // state
  this.state.is_shown = true;
  this.state.content_key = content_key;

  // callback
  if (this.state.transition_key) {
    setTimeout(this.show_callback, this.settings.show_hide_callback_wait_duration);
  } else {
    this.show_callback();
  }
};


Overlay.prototype.show_callback = function() {
  $(window).trigger("overlay.show" + (
    this.state.content_key ? "." + this.state.content_key : ""
  ));
};



//
//  Hide + callback
//
Overlay.prototype.hide = function() {
  this.state.content_key = null;
  this.state.is_shown = false;

  // pre-hide callback
  this.pre_hide_callback();

  // hide
  this.$el.add(this.$bg)
    .removeClass(this.settings.is_shown_class)
    .removeClass(this.state.content_key);

  // callback
  if (this.state.transition_key) {
    setTimeout(this.hide_callback, this.settings.show_hide_callback_wait_duration);
  } else {
    this.hide_callback();
  }
};


Overlay.prototype.pre_hide_callback = function() {
  $(window).trigger("overlay.pre_hide" + (
    this.state.content_key ? "." + this.state.content_key : ""
  ));
};


Overlay.prototype.hide_callback = function() {
  this.$el.add(this.$bg).css("display", "none");
  this.clear_content();

  $(window).trigger("overlay.hide" + (
    this.state.content_key ? "." + this.state.content_key : ""
  ));
};



//
//  Content
//
Overlay.prototype.append_content = function(x) {
  this.$content.append(x);
};


Overlay.prototype.clear_content = function() {
  this.el.innerHTML = this.settings.template_function();
  this.cache_other_elements();
};



//
//  Destroy self
//
Overlay.prototype.destroy = function() {
  this.unbind_events();
  this.$el.remove();
  this.$bg.remove();
  this.el = null;
  this.bg = null;
};



//
//  State
//
Overlay.prototype.set_initial_state_object = function() {
  var fake_el, transitions, transition_key;

  // state object
  this.state = {
    is_shown: false
  };

  // find correct transtionend key
  fake_el = document.createElement("fake");

  transitions = {
    "transition" : "transitionend",
    "WebkitTransition" : "webkitTransitionEnd",
    "MozTransition" : "transitionend",
    "msTransition" : "MSTransitionEnd",
    "OTransition" : "otransitionend"
  };

  for (var t in transitions) {
    if (fake_el.style[t] !== undefined) {
      transition_key = transitions[t];
      break;
    }
  }

  this.state.transition_key = transition_key;
};


Overlay.prototype.set_initial_settings_object = function(settings) {
  this.settings = $.extend({}, this.settings, settings || {});
};



//
//  Events
//
Overlay.prototype.bind_events = function() {
  // every element with class .close closes the overlay
  this.$el.on("click.overlay", ".close", this.close_click_handler);

  // close overlay when ESC key is pressed
  $(document).on("keydown.overlay", this.document_keydown_handler);
};


Overlay.prototype.unbind_events = function() {
  this.$el.off("click.overlay", ".close", this.close_click_handler);
  $(document).off("keydown.overlay", this.document_keydown_handler);
};


Overlay.prototype.close_click_handler = function(e) {
  e.preventDefault();

  this.hide();
};


Overlay.prototype.document_keydown_handler = function(e) {
  if (e.which == 27 && this.state.is_shown) {
    this.hide();
  }
};



//
//  Utilities
//
Overlay.prototype.bind_some_methods_to_self = function() {
  var methods = [
    "show_callback", "hide_callback",
    "close_click_handler", "document_keydown_handler"
  ];

  for (var i=0, j=methods.length; i<j; ++i) {
    this.bind_to_self(methods[i]);
  }
};


Overlay.prototype.bind_to_self = function(method_name) {
  this[method_name] = __bind(this[method_name], this);
};



//
//  Export
//
window.Overlay = Overlay;


})(jQuery || Zepto);
