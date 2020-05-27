'use strict';Object.defineProperty(exports,'__esModule',{value:true});function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}var rngBrowser = createCommonjsModule(function (module) {
// Unique ID creation requires a high quality random # generator.  In the
// browser this is a little complicated due to unknown quality of Math.random()
// and inconsistent support for the `crypto` API.  We do the best we can via
// feature-detection

// getRandomValues needs to be invoked in a context where "this" is a Crypto
// implementation. Also, find the complete implementation of crypto on IE11.
var getRandomValues = (typeof(crypto) != 'undefined' && crypto.getRandomValues && crypto.getRandomValues.bind(crypto)) ||
                      (typeof(msCrypto) != 'undefined' && typeof window.msCrypto.getRandomValues == 'function' && msCrypto.getRandomValues.bind(msCrypto));

if (getRandomValues) {
  // WHATWG crypto RNG - http://wiki.whatwg.org/wiki/Crypto
  var rnds8 = new Uint8Array(16); // eslint-disable-line no-undef

  module.exports = function whatwgRNG() {
    getRandomValues(rnds8);
    return rnds8;
  };
} else {
  // Math.random()-based (RNG)
  //
  // If all else fails, use Math.random().  It's fast, but is of unspecified
  // quality.
  var rnds = new Array(16);

  module.exports = function mathRNG() {
    for (var i = 0, r; i < 16; i++) {
      if ((i & 0x03) === 0) { r = Math.random() * 0x100000000; }
      rnds[i] = r >>> ((i & 0x03) << 3) & 0xff;
    }

    return rnds;
  };
}
});/**
 * Convert array of 16 byte values to UUID string format of the form:
 * XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
 */
var byteToHex = [];
for (var i = 0; i < 256; ++i) {
  byteToHex[i] = (i + 0x100).toString(16).substr(1);
}

function bytesToUuid(buf, offset) {
  var i = offset || 0;
  var bth = byteToHex;
  // join used to fix memory issue caused by concatenation: https://bugs.chromium.org/p/v8/issues/detail?id=3175#c4
  return ([
    bth[buf[i++]], bth[buf[i++]],
    bth[buf[i++]], bth[buf[i++]], '-',
    bth[buf[i++]], bth[buf[i++]], '-',
    bth[buf[i++]], bth[buf[i++]], '-',
    bth[buf[i++]], bth[buf[i++]], '-',
    bth[buf[i++]], bth[buf[i++]],
    bth[buf[i++]], bth[buf[i++]],
    bth[buf[i++]], bth[buf[i++]]
  ]).join('');
}

var bytesToUuid_1 = bytesToUuid;// **`v1()` - Generate time-based UUID**
//
// Inspired by https://github.com/LiosK/UUID.js
// and http://docs.python.org/library/uuid.html

var _nodeId;
var _clockseq;

// Previous uuid creation time
var _lastMSecs = 0;
var _lastNSecs = 0;

// See https://github.com/uuidjs/uuid for API details
function v1(options, buf, offset) {
  var i = buf && offset || 0;
  var b = buf || [];

  options = options || {};
  var node = options.node || _nodeId;
  var clockseq = options.clockseq !== undefined ? options.clockseq : _clockseq;

  // node and clockseq need to be initialized to random values if they're not
  // specified.  We do this lazily to minimize issues related to insufficient
  // system entropy.  See #189
  if (node == null || clockseq == null) {
    var seedBytes = rngBrowser();
    if (node == null) {
      // Per 4.5, create and 48-bit node id, (47 random bits + multicast bit = 1)
      node = _nodeId = [
        seedBytes[0] | 0x01,
        seedBytes[1], seedBytes[2], seedBytes[3], seedBytes[4], seedBytes[5]
      ];
    }
    if (clockseq == null) {
      // Per 4.2.2, randomize (14 bit) clockseq
      clockseq = _clockseq = (seedBytes[6] << 8 | seedBytes[7]) & 0x3fff;
    }
  }

  // UUID timestamps are 100 nano-second units since the Gregorian epoch,
  // (1582-10-15 00:00).  JSNumbers aren't precise enough for this, so
  // time is handled internally as 'msecs' (integer milliseconds) and 'nsecs'
  // (100-nanoseconds offset from msecs) since unix epoch, 1970-01-01 00:00.
  var msecs = options.msecs !== undefined ? options.msecs : new Date().getTime();

  // Per 4.2.1.2, use count of uuid's generated during the current clock
  // cycle to simulate higher resolution clock
  var nsecs = options.nsecs !== undefined ? options.nsecs : _lastNSecs + 1;

  // Time since last uuid creation (in msecs)
  var dt = (msecs - _lastMSecs) + (nsecs - _lastNSecs)/10000;

  // Per 4.2.1.2, Bump clockseq on clock regression
  if (dt < 0 && options.clockseq === undefined) {
    clockseq = clockseq + 1 & 0x3fff;
  }

  // Reset nsecs if clock regresses (new clockseq) or we've moved onto a new
  // time interval
  if ((dt < 0 || msecs > _lastMSecs) && options.nsecs === undefined) {
    nsecs = 0;
  }

  // Per 4.2.1.2 Throw error if too many uuids are requested
  if (nsecs >= 10000) {
    throw new Error('uuid.v1(): Can\'t create more than 10M uuids/sec');
  }

  _lastMSecs = msecs;
  _lastNSecs = nsecs;
  _clockseq = clockseq;

  // Per 4.1.4 - Convert from unix epoch to Gregorian epoch
  msecs += 12219292800000;

  // `time_low`
  var tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
  b[i++] = tl >>> 24 & 0xff;
  b[i++] = tl >>> 16 & 0xff;
  b[i++] = tl >>> 8 & 0xff;
  b[i++] = tl & 0xff;

  // `time_mid`
  var tmh = (msecs / 0x100000000 * 10000) & 0xfffffff;
  b[i++] = tmh >>> 8 & 0xff;
  b[i++] = tmh & 0xff;

  // `time_high_and_version`
  b[i++] = tmh >>> 24 & 0xf | 0x10; // include version
  b[i++] = tmh >>> 16 & 0xff;

  // `clock_seq_hi_and_reserved` (Per 4.2.2 - include variant)
  b[i++] = clockseq >>> 8 | 0x80;

  // `clock_seq_low`
  b[i++] = clockseq & 0xff;

  // `node`
  for (var n = 0; n < 6; ++n) {
    b[i + n] = node[n];
  }

  return buf ? buf : bytesToUuid_1(b);
}

var v1_1 = v1;function v4(options, buf, offset) {
  var i = buf && offset || 0;

  if (typeof(options) == 'string') {
    buf = options === 'binary' ? new Array(16) : null;
    options = null;
  }
  options = options || {};

  var rnds = options.random || (options.rng || rngBrowser)();

  // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
  rnds[6] = (rnds[6] & 0x0f) | 0x40;
  rnds[8] = (rnds[8] & 0x3f) | 0x80;

  // Copy bytes to buffer, if provided
  if (buf) {
    for (var ii = 0; ii < 16; ++ii) {
      buf[i + ii] = rnds[ii];
    }
  }

  return buf || bytesToUuid_1(rnds);
}

var v4_1 = v4;var uuid = v4_1;
uuid.v1 = v1_1;
uuid.v4 = v4_1;

var uuid_1 = uuid;//
// const uuidv4 = uuid.v4;

var instanceOrderedList = [];
var baseZIndex = 1000;
var localStorageKey = "vue-modal-window";

var script = {
  name: "VueModalWindow",
  props: {
    id: {
      type: String,
      default: function () {
        return uuid_1();
      }
    },
    contentUrl: {
      type: String
    },
    visible: {
      type: Boolean,
      default: true
    },
    enableAnotherWindow: {
      type: Boolean,
      default: false
    },
    title: {
      type: String,
      default: "vue-modal-window"
    },
    width: {
      type: Number,
      default: 300
    },
    height: {
      type: Number,
      default: 200
    },
    top: {
      type: Number,
      default: 20
    },
    left: {
      type: Number,
      default: 20
    },
    minWidth: {
      type: Number,
      default: 60
    },
    minHeight: {
      type: Number,
      default: 20
    },
    resizable: {
      type: Boolean,
      default: true
    },
    draggable: {
      type: Boolean,
      default: true
    },
    recordRect: {
      type: Boolean,
      default: true
    },
    recordVisibility: {
      type: Boolean,
      default: true
    },
    switchButtons:
    {
      type: Boolean,
      default: false
    },
    restrictByWindow:
    {
      type: Boolean,
      default: false
    }
  },
  data: function data () {
    var boundingClientRect = {
      left: parseInt(this.left),
      top: parseInt(this.top),
      right: parseInt(this.left) + parseInt(this.width),
      bottom: parseInt(this.top) + parseInt(this.height)
    };

    if (this.recordRect || this.recordVisibility) {
      var vmodalDataDict = JSON.parse(localStorage.getItem(localStorageKey));
      if (vmodalDataDict && vmodalDataDict[this.id]) {
        var vmodalData = vmodalDataDict[this.id];
        if (this.recordRect && vmodalData.rect) {
          boundingClientRect = vmodalData.rect;
        }
        if (this.recordVisibility && vmodalData.hasOwnProperty("visible")) {
          this.$emit("update:visible", vmodalData.visible);
        }
      }
    }

    return {
      boundingClientRect: boundingClientRect,
      dragging: false,
      draggingDownEvent: null,
      activeResizableName: null,
      instanceOrderedList: instanceOrderedList,
      anotherWindow: null,
      maximized: false
    };
  },
  computed: {
    rectWidth: function rectWidth () {
      return this.boundingClientRect.right - this.boundingClientRect.left;
    },
    rectHeight: function rectHeight () {
      return this.boundingClientRect.bottom - this.boundingClientRect.top;
    },
    modalStyle: function modalStyle () {
      if (this.maximized) {
        return {
          width: window.innerWidth + "px",
          height: window.innerHeight + "px",
          top: "0px",
          left: "0px",
          zIndex: this.zIndex
        };
      }
      this.validateBoundingClientRect(this.boundingClientRect);
      return {
        width: this.rectWidth + "px",
        height: this.rectHeight + "px",
        top: this.boundingClientRect.top + "px",
        left: this.boundingClientRect.left + "px",
        zIndex: this.zIndex
      };
    },
    zIndex: function zIndex () {
      return baseZIndex + this.instanceOrderedList.indexOf(this);
    },
    active: function active () {
      return (
        this.instanceOrderedList[this.instanceOrderedList.length - 1] === this
      );
    },
    visibleMain: function visibleMain () {
      return this.visible && !this.anotherWindow;
    }
  },
  mounted: function mounted () {
    this.instanceOrderedList.push(this);
    document.body.addEventListener("mousemove", this.onMouseMove, false);
    document.body.addEventListener("mouseup", this.onMouseUp, false);
    document.body.addEventListener("mouseleave", this.onMouseLeave, false);
  },
  beforeDestroy: function beforeDestroy () {
    this.deleleFromInstanceOrderedList();
    document.body.removeEventListener("mousemove", this.onMouseMove, false);
    document.body.removeEventListener("mouseup", this.onMouseUp, false);
    document.body.removeEventListener("mouseleave", this.onMouseLeave, false);
  },
  methods: {
    onMouseMove: function onMouseMove (event) {
      if (this.draggingDownEvent) {
        this.dragging = true;
      }
      if (this.dragging) {
        event.preventDefault();
        this.onDraggableMove(event);
      }
      if (this.activeResizableName) {
        event.preventDefault();
        this.resize(this.activeResizableName, event.clientX, event.clientY);
      }
    },
    onMouseUp: function onMouseUp () {
      if ((this.dragging || this.activeResizableName) && this.recordRect) {
        var vmodalDataDict =
          JSON.parse(localStorage.getItem(localStorageKey)) || {};
        if (!vmodalDataDict[this.id]) {
          vmodalDataDict[this.id] = {};
        }
        vmodalDataDict[this.id].rect = Object.assign(
          {},
          this.boundingClientRect
        );
        localStorage.setItem(localStorageKey, JSON.stringify(vmodalDataDict));
      }
      this.activeResizableName = null;
      this.dragging = false;
      this.draggingDownEvent = null;
      return true;
    },
    onClickModal: function onClickModal () {
      this.setForeground();
    },
    onClickMaximizeButton: function onClickMaximizeButton () {
      if (this.enableAnotherWindow) {
        this.openWindow();
      } else {
        this.maximize();
      }
    },
    onClickMinimizeButton: function onClickMinimizeButton () {
      this.$emit("update:visible", !this.visible);
    },
    onDraggableDown: function onDraggableDown () {
      if (
        !event.target.classList.contains("title") &&
        !event.target.classList.contains("title-text")
      ) {
        return;
      }
      this.setForeground();
      if (!this.draggable) {
        return;
      }

      this.draggingDownEvent = {
        offsetX: event.offsetX,
        offsetY: event.offsetY
      };
    },
    onMouseLeave: function onMouseLeave () {
      this.dragging = false;
      this.draggingDownEvent = null;
      this.activeResizableName = null;
      return false;
    },
    onDraggableMove: function onDraggableMove (event) {

      // boundingClientRect = position of box
      // width height = width height of box
      // window.innerHeight = window height width

      var width = this.rectWidth;
      var height = this.rectHeight;
     
      this.boundingClientRect.left =
        event.clientX - this.draggingDownEvent.offsetX;

      this.boundingClientRect.top =
        event.clientY - this.draggingDownEvent.offsetY;
      if (this.boundingClientRect.left + width < window.innerWidth - 10 || !this.restrictByWindow)
        { this.boundingClientRect.right = this.boundingClientRect.left + width; }
      if (this.boundingClientRect.top + height < window.innerHeight - 10 || !this.restrictByWindow)
        { this.boundingClientRect.bottom = this.boundingClientRect.top + height; }
    },
    onResizableDown: function onResizableDown (name) {
      if (!this.resizable) {
        return;
      }
      this.activeResizableName = name;
    },
    resize: function resize (resizableName, x, y) {
      this.dispatchResizeEvent();
      var operations = resizableName.split("-");
      if (operations.indexOf("left") !== -1) {
        this.boundingClientRect.left = Math.min(
          x,
          this.boundingClientRect.right - this.minWidth
        );
      }
      if (operations.indexOf("right") !== -1) {
        this.boundingClientRect.right = Math.max(
          x,
          this.boundingClientRect.left + this.minWidth
        );
      }
      if (operations.indexOf("top") !== -1) {
        this.boundingClientRect.top = Math.min(
          y,
          this.boundingClientRect.bottom - this.minHeight
        );
      }
      if (operations.indexOf("bottom") !== -1) {
        this.boundingClientRect.bottom = Math.max(
          y,
          this.boundingClientRect.top + this.minHeight
        );
      }
    },
    validateBoundingClientRect: function validateBoundingClientRect (rect) {
      var width = this.rectWidth;
      var height = this.rectHeight;
      rect.top = Math.min(
        Math.max(rect.top, 0),
        window.innerHeight - this.minHeight
      );
      rect.left = Math.min(
        Math.max(rect.left, this.minWidth - width),
        window.innerWidth - this.minWidth
      );
      rect.right = rect.left + width;
      rect.bottom = rect.top + height;
    },
    deleleFromInstanceOrderedList: function deleleFromInstanceOrderedList () {
      var index = this.instanceOrderedList.indexOf(this);
      if (index === -1) {
        throw new Error("This instance has not exist in instanceOrderList");
      }
      return this.instanceOrderedList.splice(index, 1);
    },
    setForeground: function setForeground () {
      this.deleleFromInstanceOrderedList();
      this.instanceOrderedList.push(this);
    },
    openWindow: function openWindow () {
      var this$1 = this;

      if (this.contentUrl) {
        this.anotherWindow = window.open(
          this.contentUrl,
          "window",
          "width=500,height=500"
        );
      } else {
        console.log(this.$refs.content.innerHTML);
        var html = this.$refs.content.innerHTML;
        /*
        this.anotherWindow = window.open(
          "data:text/html;charset=utf-8," + html,
          "window",
          "width=500,height=500"
        );
        */
        var encoded = html; //encodeURIComponent(html);
        var a = document.createElement("a");
        a.target = "_blank";
        a.href = "data:text/html;charset=utf-8," + encoded;
        a.style.display = "none";
        document.body.appendChild(a); // We need to do this,
        a.click(); // so that we can do this,
        //document.body.removeChild(a);
        return;
      }

      this.anotherWindow.addEventListener("load", function () {
        this$1.anotherWindow.addEventListener("unload", function () {
          this$1.anotherWindow = null;
        });
      });
    },
    reload: function reload () {
      if (this.contentUrl) {
        this.$refs.iframe.contentDocument.location.reload(true);
      }
    },
    maximize: function maximize () {
      if (!this.resizable) {
        return;
      }
      this.dispatchResizeEvent();
      this.maximized = !this.maximized;
    },
    dispatchResizeEvent: function dispatchResizeEvent () {
      var this$1 = this;

      if (!this.$refs.content.children || this.$refs.content.children.length === 0) {
        return;
      }
      setTimeout(function () {
        this$1.$refs.content.children[0].dispatchEvent(new Event("resize"));
      }, 0);
    }
  },
  watch: {
    visible: function visible (value) {
      if (value) {
        this.setForeground();
      } else {
        if (this.anotherWindow) {
          this.anotherWindow.close();
          this.anotherWindow = null;
        }
      }
      if (this.recordVisibility) {
        var vmodalDataDict = JSON.parse(localStorage.getItem(localStorageKey));
        if (vmodalDataDict && vmodalDataDict[this.id]) {
          var vmodalData = vmodalDataDict[this.id];
          vmodalData.visible = value;
          localStorage.setItem(localStorageKey, JSON.stringify(vmodalDataDict));
        }
      }
    }
  }
};function normalizeComponent(template, style, script, scopeId, isFunctionalTemplate, moduleIdentifier /* server only */, shadowMode, createInjector, createInjectorSSR, createInjectorShadow) {
    if (typeof shadowMode !== 'boolean') {
        createInjectorSSR = createInjector;
        createInjector = shadowMode;
        shadowMode = false;
    }
    // Vue.extend constructor export interop.
    var options = typeof script === 'function' ? script.options : script;
    // render functions
    if (template && template.render) {
        options.render = template.render;
        options.staticRenderFns = template.staticRenderFns;
        options._compiled = true;
        // functional template
        if (isFunctionalTemplate) {
            options.functional = true;
        }
    }
    // scopedId
    if (scopeId) {
        options._scopeId = scopeId;
    }
    var hook;
    if (moduleIdentifier) {
        // server build
        hook = function (context) {
            // 2.3 injection
            context =
                context || // cached call
                    (this.$vnode && this.$vnode.ssrContext) || // stateful
                    (this.parent && this.parent.$vnode && this.parent.$vnode.ssrContext); // functional
            // 2.2 with runInNewContext: true
            if (!context && typeof __VUE_SSR_CONTEXT__ !== 'undefined') {
                context = __VUE_SSR_CONTEXT__;
            }
            // inject component styles
            if (style) {
                style.call(this, createInjectorSSR(context));
            }
            // register component module identifier for async chunk inference
            if (context && context._registeredComponents) {
                context._registeredComponents.add(moduleIdentifier);
            }
        };
        // used by ssr in case component is cached and beforeCreate
        // never gets called
        options._ssrRegister = hook;
    }
    else if (style) {
        hook = shadowMode
            ? function (context) {
                style.call(this, createInjectorShadow(context, this.$root.$options.shadowRoot));
            }
            : function (context) {
                style.call(this, createInjector(context));
            };
    }
    if (hook) {
        if (options.functional) {
            // register for functional component in vue file
            var originalRender = options.render;
            options.render = function renderWithStyleInjection(h, context) {
                hook.call(context);
                return originalRender(h, context);
            };
        }
        else {
            // inject component registration as beforeCreate hook
            var existing = options.beforeCreate;
            options.beforeCreate = existing ? [].concat(existing, hook) : [hook];
        }
    }
    return script;
}function createInjectorSSR(context) {
    if (!context && typeof __VUE_SSR_CONTEXT__ !== 'undefined') {
        context = __VUE_SSR_CONTEXT__;
    }
    if (!context)
        { return function () { }; }
    if (!('styles' in context)) {
        context._styles = context._styles || {};
        Object.defineProperty(context, 'styles', {
            enumerable: true,
            get: function () { return context._renderStyles(context._styles); }
        });
        context._renderStyles = context._renderStyles || renderStyles;
    }
    return function (id, style) { return addStyle(id, style, context); };
}
function addStyle(id, css, context) {
    var group =  css.media || 'default' ;
    var style = context._styles[group] || (context._styles[group] = { ids: [], css: '' });
    if (!style.ids.includes(id)) {
        style.media = css.media;
        style.ids.push(id);
        var code = css.source;
        style.css += code + '\n';
    }
}
function renderStyles(styles) {
    var css = '';
    for (var key in styles) {
        var style = styles[key];
        css +=
            '<style data-vue-ssr-id="' +
                Array.from(style.ids).join(' ') +
                '"' +
                (style.media ? ' media="' + style.media + '"' : '') +
                '>' +
                style.css +
                '</style>';
    }
    return css;
}/* script */
var __vue_script__ = script;

/* template */
var __vue_render__ = function () {var _vm=this;var _h=_vm.$createElement;var _c=_vm._self._c||_h;return _c('div',{directives:[{name:"show",rawName:"v-show",value:(_vm.visibleMain),expression:"visibleMain"}],staticClass:"vue-modal-window"},[_vm._ssrNode("<div"+(_vm._ssrClass("main",{active: _vm.active}))+(_vm._ssrStyle(null,_vm.modalStyle, null))+" data-v-62cbf5d0>","</div>",[_vm._ssrNode("<div"+(_vm._ssrAttr("title",_vm.title))+" class=\"title\" data-v-62cbf5d0><div class=\"title-text\" data-v-62cbf5d0>"+_vm._ssrEscape(_vm._s(_vm.title))+"</div> "+((!_vm.switchButtons)?("<div class=\"head-buttons\" data-v-62cbf5d0><div class=\"head-button minimize-button\" data-v-62cbf5d0><div data-v-62cbf5d0></div></div> "+((_vm.resizable)?("<div class=\"head-button maximize-button\" data-v-62cbf5d0><div data-v-62cbf5d0></div></div>"):"<!---->")+"</div>"):"<!---->")+" "+((_vm.switchButtons)?("<div class=\"head-buttons\" data-v-62cbf5d0>"+((_vm.resizable)?("<div class=\"head-button maximize-button\" data-v-62cbf5d0><div data-v-62cbf5d0></div></div>"):"<!---->")+" <div class=\"head-button minimize-button\" data-v-62cbf5d0><div data-v-62cbf5d0></div></div></div>"):"<!---->")+"</div> "),_vm._ssrNode("<div class=\"modal-content\" data-v-62cbf5d0>","</div>",[_vm._t("default"),_vm._ssrNode(" "+((_vm.contentUrl)?("<iframe"+(_vm._ssrAttr("src",_vm.contentUrl))+" data-v-62cbf5d0></iframe>"):"<!---->"))],2),_vm._ssrNode(" "+((_vm.resizable)?("<div class=\"resizable-elements\" data-v-62cbf5d0>"+(_vm._ssrList(([
          'top-left', 'top-right', 'bottom-left', 'bottom-right',
          'top', 'left', 'right', 'bottom'
        ]),function(name){return ("<div"+(_vm._ssrClass("resizable",name))+" data-v-62cbf5d0></div>")}))+"</div>"):"<!---->"))],2),_vm._ssrNode(" <div"+(_vm._ssrClass("cover",_vm.activeResizableName))+(_vm._ssrStyle(null,null, { display: (_vm.dragging || _vm.activeResizableName) ? '' : 'none' }))+" data-v-62cbf5d0></div>")],2)};
var __vue_staticRenderFns__ = [];

  /* style */
  var __vue_inject_styles__ = function (inject) {
    if (!inject) { return }
    inject("data-v-62cbf5d0_0", { source: ".main[data-v-62cbf5d0]{position:absolute;background:#fbfdff;border-radius:4px;border:solid #d0d0d0 1px;cursor:default;box-shadow:#0000002b 0 0 3px}.main.active[data-v-62cbf5d0]{box-shadow:rgba(0,0,0,.29) 0 0 13px}.main.active .title[data-v-62cbf5d0]{background:linear-gradient(to bottom,#696969,#4a4a4a)}.main .title[data-v-62cbf5d0]{height:22px;font-size:13px;background:linear-gradient(to bottom,#585858,#383838);border-radius:4px 4px 0 0}.main .title .title-text[data-v-62cbf5d0]{color:#fff;padding-left:4px;padding-top:2px}.main .title .head-buttons[data-v-62cbf5d0]{position:absolute;top:2px;right:12px}.main .title .head-buttons .head-button[data-v-62cbf5d0]{border-radius:9px;width:15px;height:15px;background-color:#ababab;border:solid #3e3e3eb5 1px;display:inline-block}.main .title .head-buttons .head-button[data-v-62cbf5d0]:hover{background-color:#c3c3c3}.main .title .head-buttons .head-button[data-v-62cbf5d0]:active{background-color:#f5f5f5}.main .title .head-buttons .minimize-button div[data-v-62cbf5d0]{width:9px;height:1px;background-color:#4c4c4c;left:3px;position:relative;top:7px}.main .title .head-buttons .maximize-button div[data-v-62cbf5d0]{width:7px;height:7px;border:solid 1px #4c4c4c;left:3px;position:relative;top:3px}.main .modal-content[data-v-62cbf5d0]{width:100%;height:calc(100% - 22px);overflow:auto;position:relative;border-radius:0 0 4px 4px}.main .modal-content iframe[data-v-62cbf5d0]{width:100%;height:calc(100% - 3px);border:none}.main .resizable[data-v-62cbf5d0]{position:absolute}.main .resizable.left[data-v-62cbf5d0],.main .resizable.right[data-v-62cbf5d0]{width:3px;height:calc(100% - 12px);top:8px;cursor:ew-resize}.main .resizable.bottom[data-v-62cbf5d0],.main .resizable.top[data-v-62cbf5d0]{height:3px;width:calc(100% - 12px);left:8px;cursor:ns-resize}.main .resizable.bottom-left[data-v-62cbf5d0],.main .resizable.bottom-right[data-v-62cbf5d0],.main .resizable.top-left[data-v-62cbf5d0],.main .resizable.top-right[data-v-62cbf5d0]{width:8px;height:8px}.main .resizable.bottom-right[data-v-62cbf5d0],.main .resizable.right[data-v-62cbf5d0],.main .resizable.top-right[data-v-62cbf5d0]{right:0}.main .resizable.bottom-left[data-v-62cbf5d0],.main .resizable.left[data-v-62cbf5d0],.main .resizable.top-left[data-v-62cbf5d0]{left:0}.main .resizable.top[data-v-62cbf5d0],.main .resizable.top-left[data-v-62cbf5d0],.main .resizable.top-right[data-v-62cbf5d0]{top:0}.main .resizable.bottom[data-v-62cbf5d0],.main .resizable.bottom-left[data-v-62cbf5d0],.main .resizable.bottom-right[data-v-62cbf5d0]{bottom:0}.cover[data-v-62cbf5d0]{width:100%;height:100%;position:absolute;top:0;left:0;z-index:5000}.left[data-v-62cbf5d0],.right[data-v-62cbf5d0]{cursor:ew-resize}.bottom[data-v-62cbf5d0],.top[data-v-62cbf5d0]{cursor:ns-resize}.top-left[data-v-62cbf5d0]{cursor:nw-resize}.top-right[data-v-62cbf5d0]{cursor:ne-resize}.bottom-left[data-v-62cbf5d0]{cursor:sw-resize}.bottom-right[data-v-62cbf5d0]{cursor:se-resize}", map: undefined, media: undefined });

  };
  /* scoped */
  var __vue_scope_id__ = "data-v-62cbf5d0";
  /* module identifier */
  var __vue_module_identifier__ = "data-v-62cbf5d0";
  /* functional template */
  var __vue_is_functional_template__ = false;
  /* style inject shadow dom */
  

  
  var __vue_component__ = /*#__PURE__*/normalizeComponent(
    { render: __vue_render__, staticRenderFns: __vue_staticRenderFns__ },
    __vue_inject_styles__,
    __vue_script__,
    __vue_scope_id__,
    __vue_is_functional_template__,
    __vue_module_identifier__,
    false,
    undefined,
    createInjectorSSR,
    undefined
  );// Import vue component

// install function executed by Vue.use()
function install(Vue) {
  if (install.installed) { return; }
  install.installed = true;
  Vue.component('VueModalWindow', __vue_component__);
}

// Create module definition for Vue.use()
var plugin = {
  install: install,
};

// To auto-install when vue is found
/* global window global */
var GlobalVue = null;
if (typeof window !== 'undefined') {
  GlobalVue = window.Vue;
} else if (typeof global !== 'undefined') {
  GlobalVue = global.Vue;
}
if (GlobalVue) {
  GlobalVue.use(plugin);
}

// Inject install function into component - allows component
// to be registered via Vue.use() as well as Vue.component()
__vue_component__.install = install;

// It's possible to expose named exports when writing components that can
// also be used as directives, etc. - eg. import { RollupDemoDirective } from 'rollup-demo';
// export const RollupDemoDirective = component;
exports.default=__vue_component__;