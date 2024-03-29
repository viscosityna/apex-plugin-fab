(function (factory) {
    typeof define === 'function' && define.amd ? define(factory) :
    factory();
})((function () { 'use strict';

    function noop() { }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function action_destroyer(action_result) {
        return action_result && is_function(action_result.destroy) ? action_result.destroy : noop;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        if (value === null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }
    function attribute_to_object(attributes) {
        const result = {};
        for (const attribute of attributes) {
            result[attribute.name] = attribute.value;
        }
        return result;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    let SvelteElement;
    if (typeof HTMLElement === 'function') {
        SvelteElement = class extends HTMLElement {
            constructor() {
                super();
                this.attachShadow({ mode: 'open' });
            }
            connectedCallback() {
                const { on_mount } = this.$$;
                this.$$.on_disconnect = on_mount.map(run).filter(is_function);
                // @ts-ignore todo: improve typings
                for (const key in this.$$.slotted) {
                    // @ts-ignore todo: improve typings
                    this.appendChild(this.$$.slotted[key]);
                }
            }
            attributeChangedCallback(attr, _oldValue, newValue) {
                this[attr] = newValue;
            }
            disconnectedCallback() {
                run_all(this.$$.on_disconnect);
            }
            $destroy() {
                destroy_component(this, 1);
                this.$destroy = noop;
            }
            $on(type, callback) {
                // TODO should this delegate to addEventListener?
                const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
                callbacks.push(callback);
                return () => {
                    const index = callbacks.indexOf(callback);
                    if (index !== -1)
                        callbacks.splice(index, 1);
                };
            }
            $set($$props) {
                if (this.$$set && !is_empty($$props)) {
                    this.$$.skip_bound = true;
                    this.$$set($$props);
                    this.$$.skip_bound = false;
                }
            }
        };
    }

    /** Dispatch event on click outside of node */
    function clickOutside(node) {
      
      const handleClick = event => {
        if (node && !node.contains(event.composedPath()[0]) && !event.defaultPrevented) {
          node.dispatchEvent(
            new CustomEvent('click_outside', node)
          );
        }
      };

    	window.addEventListener('click', handleClick, true);
      
      return {
        destroy() {
          window.removeEventListener('click', handleClick, true);
        }
    	}
    }

    /* src\FloatingActionButton.svelte generated by Svelte v3.49.0 */

    function create_fragment(ctx) {
    	let main;
    	let div2;
    	let input;
    	let t0;
    	let div0;
    	let t1;
    	let div1;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			main = element("main");
    			div2 = element("div");
    			input = element("input");
    			t0 = space();
    			div0 = element("div");
    			t1 = space();
    			div1 = element("div");
    			div1.innerHTML = `<slot></slot>`;
    			this.c = noop;
    			attr(input, "type", "checkbox");
    			attr(div0, "class", "vis-fab");
    			attr(div1, "class", "vis-fab-context");
    			attr(div2, "class", "vis-fab-wrapper");
    			set_style(div2, "--height", /*height*/ ctx[0]);
    			set_style(div2, "--width", /*width*/ ctx[1]);
    			set_style(div2, "--fabcolor", /*fabcolor*/ ctx[2]);
    			set_style(div2, "--background", /*background*/ ctx[3]);
    			set_style(div2, "--contextbg", /*contextbg*/ ctx[4]);
    			set_style(div2, "--contexth", /*contexth*/ ctx[5]);
    			set_style(div2, "--contextw", /*contextw*/ ctx[6]);
    			set_style(div2, "--borderradius", /*borderradius*/ ctx[7]);
    			set_style(div2, "--positiony", /*positiony*/ ctx[11]);
    			set_style(div2, "--positionx", /*positionx*/ ctx[12]);
    			set_style(div2, "--ctxradius", /*ctxradius*/ ctx[8]);
    			set_style(div2, "--marginbottom", /*marginbottom*/ ctx[9]);
    			set_style(div2, "--marginright", /*marginright*/ ctx[10]);
    		},
    		m(target, anchor) {
    			insert(target, main, anchor);
    			append(main, div2);
    			append(div2, input);
    			append(div2, t0);
    			append(div2, div0);
    			append(div2, t1);
    			append(div2, div1);

    			if (!mounted) {
    				dispose = [
    					action_destroyer(clickOutside.call(null, input)),
    					listen(input, "click_outside", handleClickOutside)
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*height*/ 1) {
    				set_style(div2, "--height", /*height*/ ctx[0]);
    			}

    			if (dirty & /*width*/ 2) {
    				set_style(div2, "--width", /*width*/ ctx[1]);
    			}

    			if (dirty & /*fabcolor*/ 4) {
    				set_style(div2, "--fabcolor", /*fabcolor*/ ctx[2]);
    			}

    			if (dirty & /*background*/ 8) {
    				set_style(div2, "--background", /*background*/ ctx[3]);
    			}

    			if (dirty & /*contextbg*/ 16) {
    				set_style(div2, "--contextbg", /*contextbg*/ ctx[4]);
    			}

    			if (dirty & /*contexth*/ 32) {
    				set_style(div2, "--contexth", /*contexth*/ ctx[5]);
    			}

    			if (dirty & /*contextw*/ 64) {
    				set_style(div2, "--contextw", /*contextw*/ ctx[6]);
    			}

    			if (dirty & /*borderradius*/ 128) {
    				set_style(div2, "--borderradius", /*borderradius*/ ctx[7]);
    			}

    			if (dirty & /*ctxradius*/ 256) {
    				set_style(div2, "--ctxradius", /*ctxradius*/ ctx[8]);
    			}

    			if (dirty & /*marginbottom*/ 512) {
    				set_style(div2, "--marginbottom", /*marginbottom*/ ctx[9]);
    			}

    			if (dirty & /*marginright*/ 1024) {
    				set_style(div2, "--marginright", /*marginright*/ ctx[10]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(main);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function handleClickOutside(event) {
    	if (event.target.checked) {
    		event.target.checked = false;
    	}
    }

    function instance($$self, $$props, $$invalidate) {
    	get_current_component();
    	let { height = '50px' } = $$props;
    	let { width = '50px' } = $$props;
    	let { fabcolor = '#000000' } = $$props;
    	let { background = '#FFFFFF' } = $$props;
    	let { contextbg = '#FFFFFF' } = $$props;
    	let { contexth = 'auto' } = $$props;
    	let { contextw = 'auto' } = $$props;
    	let { position = 'bottom right' } = $$props;
    	let { borderradius = '100%' } = $$props;
    	let { ctxradius = '32px' } = $$props;
    	let { marginbottom = '16px' } = $$props;
    	let { marginright = '16px' } = $$props;
    	const positiony = position.split(' ')[0] === 'top' ? 'initial' : '0';
    	const positionx = position.split(' ')[1] === 'left' ? 'initial' : '0';

    	$$self.$$set = $$props => {
    		if ('height' in $$props) $$invalidate(0, height = $$props.height);
    		if ('width' in $$props) $$invalidate(1, width = $$props.width);
    		if ('fabcolor' in $$props) $$invalidate(2, fabcolor = $$props.fabcolor);
    		if ('background' in $$props) $$invalidate(3, background = $$props.background);
    		if ('contextbg' in $$props) $$invalidate(4, contextbg = $$props.contextbg);
    		if ('contexth' in $$props) $$invalidate(5, contexth = $$props.contexth);
    		if ('contextw' in $$props) $$invalidate(6, contextw = $$props.contextw);
    		if ('position' in $$props) $$invalidate(13, position = $$props.position);
    		if ('borderradius' in $$props) $$invalidate(7, borderradius = $$props.borderradius);
    		if ('ctxradius' in $$props) $$invalidate(8, ctxradius = $$props.ctxradius);
    		if ('marginbottom' in $$props) $$invalidate(9, marginbottom = $$props.marginbottom);
    		if ('marginright' in $$props) $$invalidate(10, marginright = $$props.marginright);
    	};

    	return [
    		height,
    		width,
    		fabcolor,
    		background,
    		contextbg,
    		contexth,
    		contextw,
    		borderradius,
    		ctxradius,
    		marginbottom,
    		marginright,
    		positiony,
    		positionx,
    		position
    	];
    }

    class FloatingActionButton extends SvelteElement {
    	constructor(options) {
    		super();
    		this.shadowRoot.innerHTML = `<style>.vis-fab-wrapper{width:var(--width, 50px);height:var(--height, 50px);position:relative;border-radius:var(--border-radius, 100%);display:flex;justify-content:center;align-items:center;margin-bottom:var(--marginbottom, 16px);margin-right:var(--marginright, 16px);position:fixed;bottom:var(--positiony);right:var(--positionx);z-index:999}.vis-fab-wrapper .vis-fab{background:var(--background, #4285f4);width:var(--width, 50px);height:var(--height, 50px);position:relative;z-index:3;border-radius:var(--borderradius, 100%);box-shadow:0 2px 4px rgba(0, 0, 0, 0.4);display:flex;justify-content:center;align-items:center;animation:vis-fab-animation-reverse 0.4s ease-out forwards}.vis-fab-wrapper .vis-fab::before,.vis-fab-wrapper .vis-fab::after{content:"";display:block;position:absolute;border-radius:4px;background:var(--fabcolor, #FFFFFF)}.vis-fab-wrapper .vis-fab::before{width:4px;height:18px}.vis-fab-wrapper .vis-fab::after{width:18px;height:4px}.vis-fab-wrapper .vis-fab-context{width:var(--contextw, auto);min-width:60px;height:var(--contexth, auto);border-radius:var(--ctxradius, 0) var(--ctxradius, 0) 0 var(--ctxradius, 0);position:absolute;background:var(--contextbg, #FFFFFF);z-index:2;padding:0.5rem 0.5rem;box-shadow:0 2px 4px rgba(0, 0, 0, 0.4);opacity:0;right:0;bottom:0;display:flex;flex-direction:column;justify-content:space-around;align-items:center;visibility:hidden;transition:opacity 0.2s ease-in, bottom 0.2s ease-in, width 0.1s ease-in, visibility 0.2s linear}.vis-fab-wrapper input{height:100%;width:100%;border-radius:var(--borderradius);cursor:pointer;position:absolute;z-index:5;opacity:0}.vis-fab-wrapper input:checked~.vis-fab{animation:vis-fab-animation 0.4s ease-out forwards}.vis-fab-wrapper input:checked~.vis-fab-context{animation:vis-fac-animation 0.4s ease-out forwards 0.1s;height:var(--contexth, auto);opacity:1;bottom:110%;visibility:visible;width:var(--contextw, auto)}@keyframes vis-fab-animation{0%{transform:rotate(0) scale(1)}20%{transform:rotate(60deg) scale(0.93)}55%{transform:rotate(35deg) scale(0.97)}80%{transform:rotate(48deg) scale(0.94)}100%{transform:rotate(45deg) scale(0.95)}}@keyframes vis-fab-animation-reverse{0%{transform:rotate(45deg) scale(0.95)}20%{transform:rotate(-15deg)}55%{transform:rotate(10deg)}80%{transform:rotate(-3deg)}100%{transform:rotate(0) scale(1)}}@keyframes vis-fac-animation{0%{transform:scale(1, 1)}33%{transform:scale(0.95, 1.05)}66%{transform:scale(1.05, 0.95)}100%{transform:scale(1, 1)}}</style>`;

    		init(
    			this,
    			{
    				target: this.shadowRoot,
    				props: attribute_to_object(this.attributes),
    				customElement: true
    			},
    			instance,
    			create_fragment,
    			safe_not_equal,
    			{
    				height: 0,
    				width: 1,
    				fabcolor: 2,
    				background: 3,
    				contextbg: 4,
    				contexth: 5,
    				contextw: 6,
    				position: 13,
    				borderradius: 7,
    				ctxradius: 8,
    				marginbottom: 9,
    				marginright: 10
    			},
    			null
    		);

    		if (options) {
    			if (options.target) {
    				insert(options.target, this, options.anchor);
    			}

    			if (options.props) {
    				this.$set(options.props);
    				flush();
    			}
    		}
    	}

    	static get observedAttributes() {
    		return [
    			"height",
    			"width",
    			"fabcolor",
    			"background",
    			"contextbg",
    			"contexth",
    			"contextw",
    			"position",
    			"borderradius",
    			"ctxradius",
    			"marginbottom",
    			"marginright"
    		];
    	}

    	get height() {
    		return this.$$.ctx[0];
    	}

    	set height(height) {
    		this.$$set({ height });
    		flush();
    	}

    	get width() {
    		return this.$$.ctx[1];
    	}

    	set width(width) {
    		this.$$set({ width });
    		flush();
    	}

    	get fabcolor() {
    		return this.$$.ctx[2];
    	}

    	set fabcolor(fabcolor) {
    		this.$$set({ fabcolor });
    		flush();
    	}

    	get background() {
    		return this.$$.ctx[3];
    	}

    	set background(background) {
    		this.$$set({ background });
    		flush();
    	}

    	get contextbg() {
    		return this.$$.ctx[4];
    	}

    	set contextbg(contextbg) {
    		this.$$set({ contextbg });
    		flush();
    	}

    	get contexth() {
    		return this.$$.ctx[5];
    	}

    	set contexth(contexth) {
    		this.$$set({ contexth });
    		flush();
    	}

    	get contextw() {
    		return this.$$.ctx[6];
    	}

    	set contextw(contextw) {
    		this.$$set({ contextw });
    		flush();
    	}

    	get position() {
    		return this.$$.ctx[13];
    	}

    	set position(position) {
    		this.$$set({ position });
    		flush();
    	}

    	get borderradius() {
    		return this.$$.ctx[7];
    	}

    	set borderradius(borderradius) {
    		this.$$set({ borderradius });
    		flush();
    	}

    	get ctxradius() {
    		return this.$$.ctx[8];
    	}

    	set ctxradius(ctxradius) {
    		this.$$set({ ctxradius });
    		flush();
    	}

    	get marginbottom() {
    		return this.$$.ctx[9];
    	}

    	set marginbottom(marginbottom) {
    		this.$$set({ marginbottom });
    		flush();
    	}

    	get marginright() {
    		return this.$$.ctx[10];
    	}

    	set marginright(marginright) {
    		this.$$set({ marginright });
    		flush();
    	}
    }

    customElements.define("vis-fab", FloatingActionButton);

}));
