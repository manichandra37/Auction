/* Small template runtime: renders <template id="dc-tpl"> with {{holes}},
   data-sc="for"/"if" blocks and event bindings, then patches the DOM on state changes. */
(function () {
  var BOOL = { checked: 'checked', disabled: 'disabled', readonly: 'readOnly', selected: 'selected', hidden: 'hidden', required: 'required', multiple: 'multiple' };
  var HOLE_ONLY = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;
  var HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;

  function lookup(path, scope) {
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (path === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    if (/^(['"]).*\1$/.test(path)) return path.slice(1, -1);
    var parts = path.split('.');
    var v = scope;
    for (var i = 0; i < parts.length; i++) {
      if (v == null) return undefined;
      v = v[parts[i]];
    }
    return v;
  }
  function interp(str, scope) {
    return str.replace(HOLE, function (_, p) {
      var v = lookup(p, scope);
      return v == null ? '' : String(v);
    });
  }
  function eventName(attr, el) {
    var n = attr.slice(2);
    if (n === 'change') {
      var tag = el.tagName;
      var type = (el.getAttribute('type') || '').toLowerCase();
      if (tag === 'TEXTAREA' || (tag === 'INPUT' && ['checkbox', 'radio', 'file'].indexOf(type) < 0)) return 'input';
    }
    return n;
  }
  function bind(el, type) {
    el.__b = el.__b || {};
    if (el.__b[type]) return;
    el.__b[type] = true;
    el.addEventListener(type, function (e) {
      var f = el.__h && el.__h[type];
      if (f) f(e);
    });
  }

  function build(node, scope, out) {
    if (node.nodeType === 3) {
      out.push(document.createTextNode(node.nodeValue.indexOf('{{') >= 0 ? interp(node.nodeValue, scope) : node.nodeValue));
      return;
    }
    if (node.nodeType !== 1) return;
    if (node.tagName === 'TEMPLATE' && node.hasAttribute('data-sc')) {
      var kind = node.getAttribute('data-sc');
      var kids = node.content.childNodes;
      if (kind === 'for') {
        var m = HOLE_ONLY.exec(node.getAttribute('list') || '');
        var list = m ? lookup(m[1], scope) : [];
        var as = node.getAttribute('as') || 'item';
        (list || []).forEach(function (item, i) {
          var s = Object.create(scope);
          s[as] = item;
          s.$index = i;
          for (var k = 0; k < kids.length; k++) build(kids[k], s, out);
        });
      } else {
        var mv = HOLE_ONLY.exec(node.getAttribute('value') || '');
        var v = mv ? lookup(mv[1], scope) : node.getAttribute('value');
        if (v) for (var j = 0; j < kids.length; j++) build(kids[j], scope, out);
      }
      return;
    }
    var el = document.createElementNS(node.namespaceURI, node.localName);
    var attrs = node.attributes;
    for (var a = 0; a < attrs.length; a++) {
      var name = attrs[a].name, val = attrs[a].value;
      if (name.indexOf('hint-') === 0) continue;
      var whole = HOLE_ONLY.exec(val);
      if (name.length > 2 && name.indexOf('on') === 0 && whole) {
        var fn = lookup(whole[1], scope);
        var type = eventName(name, node);
        if (typeof fn === 'function') {
          el.__h = el.__h || {};
          el.__h[type] = fn;
          bind(el, type);
        }
        continue;
      }
      var raw = whole ? lookup(whole[1], scope) : (val.indexOf('{{') >= 0 ? interp(val, scope) : val);
      if (BOOL[name]) {
        var on = whole ? !!raw : true;
        el.__p = el.__p || {};
        el.__p[BOOL[name]] = on;
        if (on) el.setAttribute(name, '');
        continue;
      }
      if (name === 'value' && (node.localName === 'input' || node.localName === 'textarea' || node.localName === 'select')) {
        el.__value = raw == null ? '' : String(raw);
        continue;
      }
      if (raw == null) continue;
      el.setAttribute(name, String(raw));
    }
    var ch = node.localName === 'template' ? node.content.childNodes : node.childNodes;
    var built = [];
    for (var c = 0; c < ch.length; c++) build(ch[c], scope, built);
    built.forEach(function (n) { el.appendChild(n); });
    applyProps(el, el);
    out.push(el);
  }

  function applyProps(target, src) {
    if (src.__p) for (var k in src.__p) target[k] = src.__p[k];
    if (src.__value !== undefined && target.type !== 'file' && target.value !== src.__value) target.value = src.__value;
  }

  function morphChildren(parent, fresh) {
    var live = Array.prototype.slice.call(parent.childNodes);
    for (var i = 0; i < fresh.length; i++) {
      if (i < live.length) morph(live[i], fresh[i]);
      else parent.appendChild(fresh[i]);
    }
    for (var j = fresh.length; j < live.length; j++) parent.removeChild(live[j]);
  }

  function morph(live, fresh) {
    if (live.nodeType !== fresh.nodeType || live.nodeName !== fresh.nodeName || live.namespaceURI !== fresh.namespaceURI) {
      live.parentNode.replaceChild(fresh, live);
      return;
    }
    if (live.nodeType === 3) {
      if (live.nodeValue !== fresh.nodeValue) live.nodeValue = fresh.nodeValue;
      return;
    }
    var la = live.attributes, fa = fresh.attributes, i;
    for (i = la.length - 1; i >= 0; i--) if (!fresh.hasAttribute(la[i].name)) live.removeAttribute(la[i].name);
    for (i = 0; i < fa.length; i++) if (live.getAttribute(fa[i].name) !== fa[i].value) live.setAttribute(fa[i].name, fa[i].value);
    live.__h = fresh.__h;
    if (fresh.__h) for (var t in fresh.__h) bind(live, t);
    morphChildren(live, Array.prototype.slice.call(fresh.childNodes));
    if (live.__p) for (var k in live.__p) if (!fresh.__p || !(k in fresh.__p)) live[k] = false;
    live.__p = fresh.__p;
    live.__value = fresh.__value;
    applyProps(live, fresh);
  }

  // Adds photo/photoAlt to any data object whose name has a photo in window.PHOTOS.
  function addPhotos(v, depth) {
    if (!window.PHOTOS || depth > 4 || v == null || typeof v !== 'object') return;
    if (Array.isArray(v)) { v.forEach(function (x) { addPhotos(x, depth + 1); }); return; }
    if (typeof v.name === 'string' && window.PHOTOS[v.name] && v.photo === undefined) {
      v.photo = window.PHOTOS[v.name];
      v.photoAlt = v.name + ' exterior';
    }
    for (var k in v) if (typeof v[k] === 'object') addPhotos(v[k], depth + 1);
  }

  function DCLogic(props) {
    this.props = props || {};
    this.state = undefined;
  }
  DCLogic.prototype.setState = function (patch) {
    var prev = this.state || {};
    var changed = false;
    for (var k in patch) if (prev[k] !== patch[k]) changed = true;
    this.state = Object.assign({}, prev, patch);
    if (changed && this.__render) this.__schedule();
  };
  DCLogic.prototype.forceUpdate = function () { if (this.__render) this.__schedule(); };
  window.DCLogic = DCLogic;

  window.DC = {
    mount: function (Component, defaults) {
      var props = Object.assign({}, defaults || {});
      new URLSearchParams(location.search).forEach(function (v, k) { props[k] = v; });
      var inst = new Component(props);
      var tpl = document.getElementById('dc-tpl');
      var root = document.getElementById('dc-root');
      var queued = false;
      inst.__render = function () {
        queued = false;
        var vals = inst.renderVals ? inst.renderVals() : {};
        addPhotos(vals, 0);
        var fresh = [];
        var kids = tpl.content.childNodes;
        for (var i = 0; i < kids.length; i++) build(kids[i], vals, fresh);
        morphChildren(root, fresh);
      };
      inst.__schedule = function () {
        if (queued) return;
        queued = true;
        Promise.resolve().then(inst.__render);
      };
      inst.__render();
      if (inst.componentDidMount) inst.componentDidMount();
    }
  };

  document.addEventListener('submit', function (e) { e.preventDefault(); });
})();
