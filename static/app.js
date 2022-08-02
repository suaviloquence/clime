(function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function is_promise(value) {
        return value && typeof value === 'object' && typeof value.then === 'function';
    }
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
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function get_all_dirty_from_scope($$scope) {
        if ($$scope.ctx.length > 32) {
            const dirty = [];
            const length = $$scope.ctx.length / 32;
            for (let i = 0; i < length; i++) {
                dirty[i] = -1;
            }
            return dirty;
        }
        return -1;
    }
    function set_store_value(store, ret, value) {
        store.set(value);
        return ret;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function append_styles(target, style_sheet_id, styles) {
        const append_styles_to = get_root_for_style(target);
        if (!append_styles_to.getElementById(style_sheet_id)) {
            const style = element('style');
            style.id = style_sheet_id;
            style.textContent = styles;
            append_stylesheet(append_styles_to, style);
        }
    }
    function get_root_for_style(node) {
        if (!node)
            return document;
        const root = node.getRootNode ? node.getRootNode() : node.ownerDocument;
        if (root && root.host) {
            return root;
        }
        return node.ownerDocument;
    }
    function append_stylesheet(node, style) {
        append(node.head || node, style);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
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
    function empty() {
        return text('');
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
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
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
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
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
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }

    function handle_promise(promise, info) {
        const token = info.token = {};
        function update(type, index, key, value) {
            if (info.token !== token)
                return;
            info.resolved = value;
            let child_ctx = info.ctx;
            if (key !== undefined) {
                child_ctx = child_ctx.slice();
                child_ctx[key] = value;
            }
            const block = type && (info.current = type)(child_ctx);
            let needs_flush = false;
            if (info.block) {
                if (info.blocks) {
                    info.blocks.forEach((block, i) => {
                        if (i !== index && block) {
                            group_outros();
                            transition_out(block, 1, 1, () => {
                                if (info.blocks[i] === block) {
                                    info.blocks[i] = null;
                                }
                            });
                            check_outros();
                        }
                    });
                }
                else {
                    info.block.d(1);
                }
                block.c();
                transition_in(block, 1);
                block.m(info.mount(), info.anchor);
                needs_flush = true;
            }
            info.block = block;
            if (info.blocks)
                info.blocks[index] = block;
            if (needs_flush) {
                flush();
            }
        }
        if (is_promise(promise)) {
            const current_component = get_current_component();
            promise.then(value => {
                set_current_component(current_component);
                update(info.then, 1, info.value, value);
                set_current_component(null);
            }, error => {
                set_current_component(current_component);
                update(info.catch, 2, info.error, error);
                set_current_component(null);
                if (!info.hasCatch) {
                    throw error;
                }
            });
            // if we previously had a then/catch block, destroy it
            if (info.current !== info.pending) {
                update(info.pending, 0);
                return true;
            }
        }
        else {
            if (info.current !== info.then) {
                update(info.then, 1, info.value, promise);
                return true;
            }
            info.resolved = promise;
        }
    }
    function update_await_block_branch(info, ctx, dirty) {
        const child_ctx = ctx.slice();
        const { resolved } = info;
        if (info.current === info.then) {
            child_ctx[info.value] = resolved;
        }
        if (info.current === info.catch) {
            child_ctx[info.error] = resolved;
        }
        info.block.p(child_ctx, dirty);
    }

    function get_spread_update(levels, updates) {
        const update = {};
        const to_null_out = {};
        const accounted_for = { $$scope: 1 };
        let i = levels.length;
        while (i--) {
            const o = levels[i];
            const n = updates[i];
            if (n) {
                for (const key in o) {
                    if (!(key in n))
                        to_null_out[key] = 1;
                }
                for (const key in n) {
                    if (!accounted_for[key]) {
                        update[key] = n[key];
                        accounted_for[key] = 1;
                    }
                }
                levels[i] = n;
            }
            else {
                for (const key in o) {
                    accounted_for[key] = 1;
                }
            }
        }
        for (const key in to_null_out) {
            if (!(key in update))
                update[key] = undefined;
        }
        return update;
    }
    function get_spread_object(spread_props) {
        return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
    }
    function create_component(block) {
        block && block.c();
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
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
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
    }

    const subscriber_queue = [];
    /**
     * Creates a `Readable` store that allows reading by subscription.
     * @param value initial value
     * @param {StartStopNotifier}start start and stop notifications for subscriptions
     */
    function readable(value, start) {
        return {
            subscribe: writable(value, start).subscribe
        };
    }
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }
    function derived(stores, fn, initial_value) {
        const single = !Array.isArray(stores);
        const stores_array = single
            ? [stores]
            : stores;
        const auto = fn.length < 2;
        return readable(initial_value, (set) => {
            let inited = false;
            const values = [];
            let pending = 0;
            let cleanup = noop;
            const sync = () => {
                if (pending) {
                    return;
                }
                cleanup();
                const result = fn(single ? values[0] : values, set);
                if (auto) {
                    set(result);
                }
                else {
                    cleanup = is_function(result) ? result : noop;
                }
            };
            const unsubscribers = stores_array.map((store, i) => subscribe(store, (value) => {
                values[i] = value;
                pending &= ~(1 << i);
                if (inited) {
                    sync();
                }
            }, () => {
                pending |= (1 << i);
            }));
            inited = true;
            sync();
            return function stop() {
                run_all(unsubscribers);
                cleanup();
            };
        });
    }

    /* src/components/UniversitySearch.svelte generated by Svelte v3.49.0 */

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	return child_ctx;
    }

    const get_default_slot_changes = dirty => ({ item: dirty & /*options*/ 2 });
    const get_default_slot_context = ctx => ({ item: /*item*/ ctx[6] });

    // (15:0) {:else}
    function create_else_block$3(ctx) {
    	let await_block_anchor;
    	let promise;
    	let current;

    	let info = {
    		ctx,
    		current: null,
    		token: null,
    		hasCatch: false,
    		pending: create_pending_block$4,
    		then: create_then_block$4,
    		catch: create_catch_block$4,
    		value: 1,
    		blocks: [,,,]
    	};

    	handle_promise(promise = /*options*/ ctx[1], info);

    	return {
    		c() {
    			await_block_anchor = empty();
    			info.block.c();
    		},
    		m(target, anchor) {
    			insert(target, await_block_anchor, anchor);
    			info.block.m(target, info.anchor = anchor);
    			info.mount = () => await_block_anchor.parentNode;
    			info.anchor = await_block_anchor;
    			current = true;
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			info.ctx = ctx;

    			if (dirty & /*options*/ 2 && promise !== (promise = /*options*/ ctx[1]) && handle_promise(promise, info)) ; else {
    				update_await_block_branch(info, ctx, dirty);
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(info.block);
    			current = true;
    		},
    		o(local) {
    			for (let i = 0; i < 3; i += 1) {
    				const block = info.blocks[i];
    				transition_out(block);
    			}

    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(await_block_anchor);
    			info.block.d(detaching);
    			info.token = null;
    			info = null;
    		}
    	};
    }

    // (13:0) {#if name.length < 3}
    function create_if_block$4(ctx) {
    	let p;

    	return {
    		c() {
    			p = element("p");
    			p.textContent = "Type more to load options.";
    		},
    		m(target, anchor) {
    			insert(target, p, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(p);
    		}
    	};
    }

    // (1:0) <script lang="ts">let name = ""; let options; $: options = search(name); async function search(search) {     if (search.length < 3)         return [];     return await (await fetch(`/api/university/search?${new URLSearchParams({ search: name }
    function create_catch_block$4(ctx) {
    	return {
    		c: noop,
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};
    }

    // (18:2) {:then options}
    function create_then_block$4(ctx) {
    	let ol;
    	let current;
    	let each_value = /*options*/ ctx[1];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	return {
    		c() {
    			ol = element("ol");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}
    		},
    		m(target, anchor) {
    			insert(target, ol, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ol, null);
    			}

    			current = true;
    		},
    		p(ctx, dirty) {
    			if (dirty & /*$$scope, options*/ 6) {
    				each_value = /*options*/ ctx[1];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$2(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$2(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(ol, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(ol);
    			destroy_each(each_blocks, detaching);
    		}
    	};
    }

    // (20:6) {#each options as item}
    function create_each_block$2(ctx) {
    	let li;
    	let t;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[3].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[2], get_default_slot_context);

    	return {
    		c() {
    			li = element("li");
    			if (default_slot) default_slot.c();
    			t = space();
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);

    			if (default_slot) {
    				default_slot.m(li, null);
    			}

    			append(li, t);
    			current = true;
    		},
    		p(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope, options*/ 6)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[2],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[2])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[2], dirty, get_default_slot_changes),
    						get_default_slot_context
    					);
    				}
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(li);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};
    }

    // (16:18)      Loading...   {:then options}
    function create_pending_block$4(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Loading...");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    function create_fragment$8(ctx) {
    	let div;
    	let input;
    	let t;
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	let mounted;
    	let dispose;
    	const if_block_creators = [create_if_block$4, create_else_block$3];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*name*/ ctx[0].length < 3) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	return {
    		c() {
    			div = element("div");
    			input = element("input");
    			t = space();
    			if_block.c();
    			if_block_anchor = empty();
    			attr(input, "type", "text");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, input);
    			set_input_value(input, /*name*/ ctx[0]);
    			insert(target, t, anchor);
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = listen(input, "input", /*input_input_handler*/ ctx[4]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*name*/ 1 && input.value !== /*name*/ ctx[0]) {
    				set_input_value(input, /*name*/ ctx[0]);
    			}

    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			if (detaching) detach(t);
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach(if_block_anchor);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	let name = "";
    	let options;

    	async function search(search) {
    		if (search.length < 3) return [];
    		return await (await fetch(`/api/university/search?${new URLSearchParams({ search: name })}`)).json();
    	}

    	function input_input_handler() {
    		name = this.value;
    		$$invalidate(0, name);
    	}

    	$$self.$$set = $$props => {
    		if ('$$scope' in $$props) $$invalidate(2, $$scope = $$props.$$scope);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*name*/ 1) {
    			$$invalidate(1, options = search(name));
    		}
    	};

    	return [name, options, $$scope, slots, input_input_handler];
    }

    class UniversitySearch extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$7, create_fragment$8, safe_not_equal, {});
    	}
    }

    /* src/pages/AddUniversity.svelte generated by Svelte v3.49.0 */

    function create_catch_block$3(ctx) {
    	return { c: noop, m: noop, p: noop, d: noop };
    }

    // (22:26)      <button on:click={() => swap(id)}
    function create_then_block$3(ctx) {
    	let button;

    	let t_value = (/*user*/ ctx[9].universities.includes(/*id*/ ctx[8])
    	? "Remove"
    	: "Add") + "";

    	let t;
    	let mounted;
    	let dispose;

    	function click_handler_1() {
    		return /*click_handler_1*/ ctx[4](/*id*/ ctx[8]);
    	}

    	return {
    		c() {
    			button = element("button");
    			t = text(t_value);
    		},
    		m(target, anchor) {
    			insert(target, button, anchor);
    			append(button, t);

    			if (!mounted) {
    				dispose = listen(button, "click", click_handler_1);
    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*$user, id*/ 258 && t_value !== (t_value = (/*user*/ ctx[9].universities.includes(/*id*/ ctx[8])
    			? "Remove"
    			: "Add") + "")) set_data(t, t_value);
    		},
    		d(detaching) {
    			if (detaching) detach(button);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (1:0) <script lang="ts">import { isAuthed, user, authedFetch }
    function create_pending_block$3(ctx) {
    	return { c: noop, m: noop, p: noop, d: noop };
    }

    // (19:0) <UniversitySearch let:item={{ name, id }}>
    function create_default_slot(ctx) {
    	let t0_value = /*name*/ ctx[7] + "";
    	let t0;
    	let t1;
    	let button;
    	let t3;
    	let await_block_anchor;
    	let promise;
    	let mounted;
    	let dispose;

    	function click_handler() {
    		return /*click_handler*/ ctx[3](/*id*/ ctx[8]);
    	}

    	let info = {
    		ctx,
    		current: null,
    		token: null,
    		hasCatch: false,
    		pending: create_pending_block$3,
    		then: create_then_block$3,
    		catch: create_catch_block$3,
    		value: 9
    	};

    	handle_promise(promise = /*$user*/ ctx[1], info);

    	return {
    		c() {
    			t0 = text(t0_value);
    			t1 = text(":\n  ");
    			button = element("button");
    			button.textContent = "Info";
    			t3 = space();
    			await_block_anchor = empty();
    			info.block.c();
    		},
    		m(target, anchor) {
    			insert(target, t0, anchor);
    			insert(target, t1, anchor);
    			insert(target, button, anchor);
    			insert(target, t3, anchor);
    			insert(target, await_block_anchor, anchor);
    			info.block.m(target, info.anchor = anchor);
    			info.mount = () => await_block_anchor.parentNode;
    			info.anchor = await_block_anchor;

    			if (!mounted) {
    				dispose = listen(button, "click", click_handler);
    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*name*/ 128 && t0_value !== (t0_value = /*name*/ ctx[7] + "")) set_data(t0, t0_value);
    			info.ctx = ctx;

    			if (dirty & /*$user*/ 2 && promise !== (promise = /*$user*/ ctx[1]) && handle_promise(promise, info)) ; else {
    				update_await_block_branch(info, ctx, dirty);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(t0);
    			if (detaching) detach(t1);
    			if (detaching) detach(button);
    			if (detaching) detach(t3);
    			if (detaching) detach(await_block_anchor);
    			info.block.d(detaching);
    			info.token = null;
    			info = null;
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function create_fragment$7(ctx) {
    	let universitysearch;
    	let current;

    	universitysearch = new UniversitySearch({
    			props: {
    				$$slots: {
    					default: [
    						create_default_slot,
    						({ item: { name, id } }) => ({ 7: name, 8: id }),
    						({ item: name_name_id_id }) => (name_name_id_id ? 128 : 0) | (name_name_id_id ? 256 : 0)
    					]
    				},
    				$$scope: { ctx }
    			}
    		});

    	return {
    		c() {
    			create_component(universitysearch.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(universitysearch, target, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			const universitysearch_changes = {};

    			if (dirty & /*$$scope, $user, id, $path, name*/ 1411) {
    				universitysearch_changes.$$scope = { dirty, ctx };
    			}

    			universitysearch.$set(universitysearch_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(universitysearch.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(universitysearch.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(universitysearch, detaching);
    		}
    	};
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let $path;
    	let $authedFetch;
    	let $user;
    	let $isAuthed;
    	component_subscribe($$self, path, $$value => $$invalidate(0, $path = $$value));
    	component_subscribe($$self, authedFetch, $$value => $$invalidate(5, $authedFetch = $$value));
    	component_subscribe($$self, user, $$value => $$invalidate(1, $user = $$value));
    	component_subscribe($$self, isAuthed, $$value => $$invalidate(6, $isAuthed = $$value));
    	if (!$isAuthed) set_store_value(path, $path = "/user/login", $path);

    	async function swap(id) {
    		let u = await $user;

    		await $authedFetch("/api/user/me/universities", {
    			headers: { "Content-Type": "application/json" },
    			method: u.universities.includes(id) ? "DELETE" : "PUT",
    			body: JSON.stringify({ id })
    		});

    		set_store_value(path, $path = "/dashboard", $path);
    	}

    	const click_handler = id => set_store_value(path, $path = `/university/${id}`, $path);
    	const click_handler_1 = id => swap(id);
    	return [$path, $user, swap, click_handler, click_handler_1];
    }

    class AddUniversity extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$6, create_fragment$7, safe_not_equal, {});
    	}
    }

    /* src/pages/Login.svelte generated by Svelte v3.49.0 */

    function add_css(target) {
    	append_styles(target, "svelte-1fi3y4c", ".error.svelte-1fi3y4c{color:red}");
    }

    // (42:2) {:else}
    function create_else_block$2(ctx) {
    	let div;
    	let label;
    	let t1;
    	let input;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			div = element("div");
    			label = element("label");
    			label.textContent = "Name:";
    			t1 = space();
    			input = element("input");
    			attr(label, "for", "name");
    			attr(input, "type", "text");
    			attr(input, "id", "name");
    			input.required = true;
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, label);
    			append(div, t1);
    			append(div, input);
    			set_input_value(input, /*name*/ ctx[2]);

    			if (!mounted) {
    				dispose = listen(input, "input", /*input_input_handler_1*/ ctx[7]);
    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty & /*name*/ 4 && input.value !== /*name*/ ctx[2]) {
    				set_input_value(input, /*name*/ ctx[2]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (37:2) {#if mode === "login"}
    function create_if_block_1$1(ctx) {
    	let div;
    	let label;
    	let t1;
    	let input;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			div = element("div");
    			label = element("label");
    			label.textContent = "ID:";
    			t1 = space();
    			input = element("input");
    			attr(label, "for", "id");
    			attr(input, "type", "text");
    			attr(input, "id", "id");
    			input.required = true;
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, label);
    			append(div, t1);
    			append(div, input);
    			set_input_value(input, /*id*/ ctx[1]);

    			if (!mounted) {
    				dispose = listen(input, "input", /*input_input_handler*/ ctx[6]);
    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty & /*id*/ 2 && input.value !== /*id*/ ctx[1]) {
    				set_input_value(input, /*id*/ ctx[1]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (49:2) {#if error}
    function create_if_block$3(ctx) {
    	let p;
    	let t;

    	return {
    		c() {
    			p = element("p");
    			t = text(/*error*/ ctx[3]);
    			attr(p, "class", "error svelte-1fi3y4c");
    		},
    		m(target, anchor) {
    			insert(target, p, anchor);
    			append(p, t);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*error*/ 8) set_data(t, /*error*/ ctx[3]);
    		},
    		d(detaching) {
    			if (detaching) detach(p);
    		}
    	};
    }

    function create_fragment$6(ctx) {
    	let form;
    	let t0;
    	let t1;
    	let button0;

    	let t2_value = (/*mode*/ ctx[0] === "login"
    	? "Log in"
    	: "Create account") + "";

    	let t2;
    	let t3;
    	let div;
    	let t4;
    	let button1;

    	let t5_value = (/*mode*/ ctx[0] === "login"
    	? "Create account"
    	: "Log in") + "";

    	let t5;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*mode*/ ctx[0] === "login") return create_if_block_1$1;
    		return create_else_block$2;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type(ctx);
    	let if_block1 = /*error*/ ctx[3] && create_if_block$3(ctx);

    	return {
    		c() {
    			form = element("form");
    			if_block0.c();
    			t0 = space();
    			if (if_block1) if_block1.c();
    			t1 = space();
    			button0 = element("button");
    			t2 = text(t2_value);
    			t3 = space();
    			div = element("div");
    			t4 = text("Or, ");
    			button1 = element("button");
    			t5 = text(t5_value);
    			attr(button0, "type", "submit");
    		},
    		m(target, anchor) {
    			insert(target, form, anchor);
    			if_block0.m(form, null);
    			append(form, t0);
    			if (if_block1) if_block1.m(form, null);
    			append(form, t1);
    			append(form, button0);
    			append(button0, t2);
    			append(form, t3);
    			append(form, div);
    			append(div, t4);
    			append(div, button1);
    			append(button1, t5);

    			if (!mounted) {
    				dispose = [
    					listen(button1, "click", /*swap*/ ctx[5]),
    					listen(form, "submit", /*submit*/ ctx[4])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block0) {
    				if_block0.p(ctx, dirty);
    			} else {
    				if_block0.d(1);
    				if_block0 = current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(form, t0);
    				}
    			}

    			if (/*error*/ ctx[3]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block$3(ctx);
    					if_block1.c();
    					if_block1.m(form, t1);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (dirty & /*mode*/ 1 && t2_value !== (t2_value = (/*mode*/ ctx[0] === "login"
    			? "Log in"
    			: "Create account") + "")) set_data(t2, t2_value);

    			if (dirty & /*mode*/ 1 && t5_value !== (t5_value = (/*mode*/ ctx[0] === "login"
    			? "Create account"
    			: "Log in") + "")) set_data(t5, t5_value);
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(form);
    			if_block0.d();
    			if (if_block1) if_block1.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let $path;
    	let $auth;
    	let $isAuthed;
    	component_subscribe($$self, path, $$value => $$invalidate(9, $path = $$value));
    	component_subscribe($$self, auth, $$value => $$invalidate(10, $auth = $$value));
    	component_subscribe($$self, isAuthed, $$value => $$invalidate(11, $isAuthed = $$value));

    	if ($isAuthed) {
    		set_store_value(path, $path = "/dashboard", $path);
    	}

    	let { mode } = $$props;
    	let id;
    	let name;
    	let error = null;

    	async function submit(evt) {
    		evt.preventDefault();
    		let body = mode === "login" ? { id } : { metadata: { name } };

    		let res = await fetch(`/api/user/${mode}`, {
    			method: "POST",
    			headers: { "Content-Type": "application/json" },
    			body: JSON.stringify(body)
    		});

    		if (!res.ok) {
    			$$invalidate(3, error = await res.text());
    			return;
    		}

    		set_store_value(auth, $auth = await res.json(), $auth);
    		set_store_value(path, $path = "/dashboard", $path);
    	}

    	function swap() {
    		$$invalidate(0, mode = mode === "create" ? "login" : "create");
    	}

    	function input_input_handler() {
    		id = this.value;
    		$$invalidate(1, id);
    	}

    	function input_input_handler_1() {
    		name = this.value;
    		$$invalidate(2, name);
    	}

    	$$self.$$set = $$props => {
    		if ('mode' in $$props) $$invalidate(0, mode = $$props.mode);
    	};

    	return [
    		mode,
    		id,
    		name,
    		error,
    		submit,
    		swap,
    		input_input_handler,
    		input_input_handler_1
    	];
    }

    class Login extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$5, create_fragment$6, safe_not_equal, { mode: 0 }, add_css);
    	}
    }

    /* src/components/WeatherInfo.svelte generated by Svelte v3.49.0 */

    function create_if_block$2(ctx) {
    	let t0;
    	let t1;

    	return {
    		c() {
    			t0 = text(/*name*/ ctx[1]);
    			t1 = text(":");
    		},
    		m(target, anchor) {
    			insert(target, t0, anchor);
    			insert(target, t1, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*name*/ 2) set_data(t0, /*name*/ ctx[1]);
    		},
    		d(detaching) {
    			if (detaching) detach(t0);
    			if (detaching) detach(t1);
    		}
    	};
    }

    function create_fragment$5(ctx) {
    	let h3;
    	let t0;
    	let t1_value = /*formatDate*/ ctx[2](new Date(/*weather*/ ctx[0].time * 1000)) + "";
    	let t1;
    	let t2;
    	let t3_value = toFahrenheit(/*weather*/ ctx[0].temperature).toFixed(1) + "";
    	let t3;
    	let t4;
    	let t5;
    	let ul;
    	let li0;
    	let t6_value = /*weather*/ ctx[0].weather_description + "";
    	let t6;
    	let t7;
    	let li1;
    	let t8;
    	let t9_value = toFahrenheit(/*weather*/ ctx[0].feels_like).toFixed(1) + "";
    	let t9;
    	let t10;
    	let t11;
    	let li2;
    	let t12;
    	let t13_value = /*weather*/ ctx[0].humidity.toFixed(1) + "";
    	let t13;
    	let t14;
    	let t15;
    	let li3;
    	let t16;
    	let t17_value = /*weather*/ ctx[0].pressure.toFixed(1) + "";
    	let t17;
    	let t18;
    	let t19;
    	let li4;
    	let t20;
    	let t21_value = toMph(/*weather*/ ctx[0].wind_speed).toFixed(1) + "";
    	let t21;
    	let t22;
    	let t23;
    	let li5;
    	let t24;
    	let t25_value = /*weather*/ ctx[0].cloudiness.toFixed(1) + "";
    	let t25;
    	let t26;
    	let if_block = /*name*/ ctx[1] && create_if_block$2(ctx);

    	return {
    		c() {
    			h3 = element("h3");
    			if (if_block) if_block.c();
    			t0 = space();
    			t1 = text(t1_value);
    			t2 = space();
    			t3 = text(t3_value);
    			t4 = text("°F");
    			t5 = space();
    			ul = element("ul");
    			li0 = element("li");
    			t6 = text(t6_value);
    			t7 = space();
    			li1 = element("li");
    			t8 = text("Feels like: ");
    			t9 = text(t9_value);
    			t10 = text("°F");
    			t11 = space();
    			li2 = element("li");
    			t12 = text("humidity: ");
    			t13 = text(t13_value);
    			t14 = text("%");
    			t15 = space();
    			li3 = element("li");
    			t16 = text("pressure: ");
    			t17 = text(t17_value);
    			t18 = text(" hPa");
    			t19 = space();
    			li4 = element("li");
    			t20 = text("wind: ");
    			t21 = text(t21_value);
    			t22 = text(" mph");
    			t23 = space();
    			li5 = element("li");
    			t24 = text("cloudiess: ");
    			t25 = text(t25_value);
    			t26 = text("%");
    		},
    		m(target, anchor) {
    			insert(target, h3, anchor);
    			if (if_block) if_block.m(h3, null);
    			append(h3, t0);
    			append(h3, t1);
    			append(h3, t2);
    			append(h3, t3);
    			append(h3, t4);
    			insert(target, t5, anchor);
    			insert(target, ul, anchor);
    			append(ul, li0);
    			append(li0, t6);
    			append(ul, t7);
    			append(ul, li1);
    			append(li1, t8);
    			append(li1, t9);
    			append(li1, t10);
    			append(ul, t11);
    			append(ul, li2);
    			append(li2, t12);
    			append(li2, t13);
    			append(li2, t14);
    			append(ul, t15);
    			append(ul, li3);
    			append(li3, t16);
    			append(li3, t17);
    			append(li3, t18);
    			append(ul, t19);
    			append(ul, li4);
    			append(li4, t20);
    			append(li4, t21);
    			append(li4, t22);
    			append(ul, t23);
    			append(ul, li5);
    			append(li5, t24);
    			append(li5, t25);
    			append(li5, t26);
    		},
    		p(ctx, [dirty]) {
    			if (/*name*/ ctx[1]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$2(ctx);
    					if_block.c();
    					if_block.m(h3, t0);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*weather*/ 1 && t1_value !== (t1_value = /*formatDate*/ ctx[2](new Date(/*weather*/ ctx[0].time * 1000)) + "")) set_data(t1, t1_value);
    			if (dirty & /*weather*/ 1 && t3_value !== (t3_value = toFahrenheit(/*weather*/ ctx[0].temperature).toFixed(1) + "")) set_data(t3, t3_value);
    			if (dirty & /*weather*/ 1 && t6_value !== (t6_value = /*weather*/ ctx[0].weather_description + "")) set_data(t6, t6_value);
    			if (dirty & /*weather*/ 1 && t9_value !== (t9_value = toFahrenheit(/*weather*/ ctx[0].feels_like).toFixed(1) + "")) set_data(t9, t9_value);
    			if (dirty & /*weather*/ 1 && t13_value !== (t13_value = /*weather*/ ctx[0].humidity.toFixed(1) + "")) set_data(t13, t13_value);
    			if (dirty & /*weather*/ 1 && t17_value !== (t17_value = /*weather*/ ctx[0].pressure.toFixed(1) + "")) set_data(t17, t17_value);
    			if (dirty & /*weather*/ 1 && t21_value !== (t21_value = toMph(/*weather*/ ctx[0].wind_speed).toFixed(1) + "")) set_data(t21, t21_value);
    			if (dirty & /*weather*/ 1 && t25_value !== (t25_value = /*weather*/ ctx[0].cloudiness.toFixed(1) + "")) set_data(t25, t25_value);
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(h3);
    			if (if_block) if_block.d();
    			if (detaching) detach(t5);
    			if (detaching) detach(ul);
    		}
    	};
    }

    function toFahrenheit(kelvin) {
    	return (kelvin - 273.15) * 1.8 + 32;
    }

    function toMph(mps) {
    	return mps * 2.237;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { weather } = $$props;
    	let { name = null } = $$props;
    	const fmt = new Intl.DateTimeFormat(undefined, { weekday: "long", hour: "numeric" });

    	function formatDate(date) {
    		return fmt.format(date);
    	}

    	$$self.$$set = $$props => {
    		if ('weather' in $$props) $$invalidate(0, weather = $$props.weather);
    		if ('name' in $$props) $$invalidate(1, name = $$props.name);
    	};

    	return [weather, name, formatDate];
    }

    class WeatherInfo extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$4, create_fragment$5, safe_not_equal, { weather: 0, name: 1 });
    	}
    }

    /* src/pages/UniversityInfo.svelte generated by Svelte v3.49.0 */

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[7] = list[i];
    	return child_ctx;
    }

    // (1:0) <script lang="ts">import WeatherInfo from "../components/WeatherInfo.svelte"; import { isAuthed, authedFetch, user }
    function create_catch_block_2(ctx) {
    	return {
    		c: noop,
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};
    }

    // (48:0) {:then university}
    function create_then_block$2(ctx) {
    	let h1;
    	let t0_value = /*university*/ ctx[6].name + "";
    	let t0;
    	let t1;
    	let h3;
    	let a;
    	let t2;
    	let t3;
    	let t4;
    	let div;
    	let button0;
    	let t6;
    	let button1;
    	let t8;
    	let button2;
    	let t10;
    	let button3;
    	let t12;
    	let current_block_type_index;
    	let if_block1;
    	let if_block1_anchor;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block0 = /*$isAuthed*/ ctx[4] && create_if_block_26(ctx);
    	const if_block_creators = [create_if_block$1, create_if_block_1, create_if_block_6, create_if_block_22];
    	const if_blocks = [];

    	function select_block_type_1(ctx, dirty) {
    		if (/*tab*/ ctx[2] === /*Tab*/ ctx[1].Weather) return 0;
    		if (/*tab*/ ctx[2] === /*Tab*/ ctx[1].Stats) return 1;
    		if (/*tab*/ ctx[2] === /*Tab*/ ctx[1].Admissions) return 2;
    		if (/*tab*/ ctx[2] === /*Tab*/ ctx[1].Costs) return 3;
    		return -1;
    	}

    	if (~(current_block_type_index = select_block_type_1(ctx))) {
    		if_block1 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	}

    	return {
    		c() {
    			h1 = element("h1");
    			t0 = text(t0_value);
    			t1 = space();
    			h3 = element("h3");
    			a = element("a");
    			t2 = text("Official website");
    			t3 = space();
    			if (if_block0) if_block0.c();
    			t4 = space();
    			div = element("div");
    			button0 = element("button");
    			button0.textContent = "Weather";
    			t6 = space();
    			button1 = element("button");
    			button1.textContent = "Statistics";
    			t8 = space();
    			button2 = element("button");
    			button2.textContent = "Admissions Info";
    			t10 = space();
    			button3 = element("button");
    			button3.textContent = "Costs";
    			t12 = space();
    			if (if_block1) if_block1.c();
    			if_block1_anchor = empty();
    			attr(a, "href", normalizeUrl(/*university*/ ctx[6].website));
    			attr(a, "target", "_blank");
    		},
    		m(target, anchor) {
    			insert(target, h1, anchor);
    			append(h1, t0);
    			insert(target, t1, anchor);
    			insert(target, h3, anchor);
    			append(h3, a);
    			append(a, t2);
    			insert(target, t3, anchor);
    			if (if_block0) if_block0.m(target, anchor);
    			insert(target, t4, anchor);
    			insert(target, div, anchor);
    			append(div, button0);
    			append(div, t6);
    			append(div, button1);
    			append(div, t8);
    			append(div, button2);
    			append(div, t10);
    			append(div, button3);
    			insert(target, t12, anchor);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].m(target, anchor);
    			}

    			insert(target, if_block1_anchor, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen(button0, "click", /*click_handler*/ ctx[8]),
    					listen(button1, "click", /*click_handler_1*/ ctx[9]),
    					listen(button2, "click", /*click_handler_2*/ ctx[10]),
    					listen(button3, "click", /*click_handler_3*/ ctx[11])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (/*$isAuthed*/ ctx[4]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_26(ctx);
    					if_block0.c();
    					if_block0.m(t4.parentNode, t4);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type_1(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if (~current_block_type_index) {
    					if_blocks[current_block_type_index].p(ctx, dirty);
    				}
    			} else {
    				if (if_block1) {
    					group_outros();

    					transition_out(if_blocks[previous_block_index], 1, 1, () => {
    						if_blocks[previous_block_index] = null;
    					});

    					check_outros();
    				}

    				if (~current_block_type_index) {
    					if_block1 = if_blocks[current_block_type_index];

    					if (!if_block1) {
    						if_block1 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    						if_block1.c();
    					} else {
    						if_block1.p(ctx, dirty);
    					}

    					transition_in(if_block1, 1);
    					if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
    				} else {
    					if_block1 = null;
    				}
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block1);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block1);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(h1);
    			if (detaching) detach(t1);
    			if (detaching) detach(h3);
    			if (detaching) detach(t3);
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach(t4);
    			if (detaching) detach(div);
    			if (detaching) detach(t12);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].d(detaching);
    			}

    			if (detaching) detach(if_block1_anchor);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (55:2) {#if $isAuthed}
    function create_if_block_26(ctx) {
    	let await_block_anchor;
    	let promise;

    	let info = {
    		ctx,
    		current: null,
    		token: null,
    		hasCatch: false,
    		pending: create_pending_block_2,
    		then: create_then_block_2,
    		catch: create_catch_block_1,
    		value: 16
    	};

    	handle_promise(promise = /*$user*/ ctx[3], info);

    	return {
    		c() {
    			await_block_anchor = empty();
    			info.block.c();
    		},
    		m(target, anchor) {
    			insert(target, await_block_anchor, anchor);
    			info.block.m(target, info.anchor = anchor);
    			info.mount = () => await_block_anchor.parentNode;
    			info.anchor = await_block_anchor;
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			info.ctx = ctx;

    			if (dirty & /*$user*/ 8 && promise !== (promise = /*$user*/ ctx[3]) && handle_promise(promise, info)) ; else {
    				update_await_block_branch(info, ctx, dirty);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(await_block_anchor);
    			info.block.d(detaching);
    			info.token = null;
    			info = null;
    		}
    	};
    }

    // (1:0) <script lang="ts">import WeatherInfo from "../components/WeatherInfo.svelte"; import { isAuthed, authedFetch, user }
    function create_catch_block_1(ctx) {
    	return { c: noop, m: noop, p: noop, d: noop };
    }

    // (56:28)        <div>         {#if user.universities.includes(id)}
    function create_then_block_2(ctx) {
    	let div;
    	let show_if;

    	function select_block_type(ctx, dirty) {
    		if (dirty & /*$user, id*/ 9) show_if = null;
    		if (show_if == null) show_if = !!/*user*/ ctx[16].universities.includes(/*id*/ ctx[0]);
    		if (show_if) return create_if_block_27;
    		return create_else_block$1;
    	}

    	let current_block_type = select_block_type(ctx, -1);
    	let if_block = current_block_type(ctx);

    	return {
    		c() {
    			div = element("div");
    			if_block.c();
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			if_block.m(div, null);
    		},
    		p(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx, dirty)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div, null);
    				}
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			if_block.d();
    		}
    	};
    }

    // (60:8) {:else}
    function create_else_block$1(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			button = element("button");
    			button.textContent = "Add to dashboard";
    		},
    		m(target, anchor) {
    			insert(target, button, anchor);

    			if (!mounted) {
    				dispose = listen(button, "click", /*updateDashboard*/ ctx[5]);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(button);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (58:8) {#if user.universities.includes(id)}
    function create_if_block_27(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			button = element("button");
    			button.textContent = "Remove from dashboard";
    		},
    		m(target, anchor) {
    			insert(target, button, anchor);

    			if (!mounted) {
    				dispose = listen(button, "click", /*updateDashboard*/ ctx[5]);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(button);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (1:0) <script lang="ts">import WeatherInfo from "../components/WeatherInfo.svelte"; import { isAuthed, authedFetch, user }
    function create_pending_block_2(ctx) {
    	return { c: noop, m: noop, p: noop, d: noop };
    }

    // (209:30) 
    function create_if_block_22(ctx) {
    	let p;
    	let t1;
    	let ul;
    	let t2;
    	let t3;
    	let if_block0 = /*university*/ ctx[6].price_in_district && create_if_block_25(ctx);
    	let if_block1 = /*university*/ ctx[6].price_in_state && create_if_block_24(ctx);
    	let if_block2 = /*university*/ ctx[6].price_out_of_state && create_if_block_23(ctx);

    	return {
    		c() {
    			p = element("p");
    			p.textContent = "Note: the following costs represent the total cost of attendance (i.e.,\n      without financial aid)";
    			t1 = space();
    			ul = element("ul");
    			if (if_block0) if_block0.c();
    			t2 = space();
    			if (if_block1) if_block1.c();
    			t3 = space();
    			if (if_block2) if_block2.c();
    		},
    		m(target, anchor) {
    			insert(target, p, anchor);
    			insert(target, t1, anchor);
    			insert(target, ul, anchor);
    			if (if_block0) if_block0.m(ul, null);
    			append(ul, t2);
    			if (if_block1) if_block1.m(ul, null);
    			append(ul, t3);
    			if (if_block2) if_block2.m(ul, null);
    		},
    		p(ctx, dirty) {
    			if (/*university*/ ctx[6].price_in_district) if_block0.p(ctx, dirty);
    			if (/*university*/ ctx[6].price_in_state) if_block1.p(ctx, dirty);
    			if (/*university*/ ctx[6].price_out_of_state) if_block2.p(ctx, dirty);
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(p);
    			if (detaching) detach(t1);
    			if (detaching) detach(ul);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    		}
    	};
    }

    // (106:35) 
    function create_if_block_6(ctx) {
    	let t0;
    	let t1;
    	let h20;
    	let t3;
    	let ul0;
    	let li0;
    	let t4;
    	let t5_value = considerationString(/*university*/ ctx[6].considers_gpa) + "";
    	let t5;
    	let t6;
    	let li1;
    	let t7;
    	let t8_value = considerationString(/*university*/ ctx[6].considers_class_rank) + "";
    	let t8;
    	let t9;
    	let li2;
    	let t10;
    	let t11_value = considerationString(/*university*/ ctx[6].considers_transcript) + "";
    	let t11;
    	let t12;
    	let li3;
    	let t13;
    	let t14_value = considerationString(/*university*/ ctx[6].considers_recommendations) + "";
    	let t14;
    	let t15;
    	let li4;
    	let t16;
    	let t17_value = considerationString(/*university*/ ctx[6].considers_test_scores) + "";
    	let t17;
    	let t18;
    	let li5;
    	let t19;
    	let t20_value = considerationString(/*university*/ ctx[6].considers_toefl) + "";
    	let t20;
    	let t21;
    	let h21;
    	let t23;
    	let ul1;
    	let t24;
    	let t25;
    	let t26;
    	let t27;
    	let t28;
    	let h3;
    	let t30;
    	let h40;
    	let t32;
    	let ul2;
    	let t33;
    	let t34;
    	let t35;
    	let t36;
    	let h41;
    	let t38;
    	let ul3;
    	let t39;
    	let t40;
    	let t41;
    	let if_block0 = /*university*/ ctx[6].admissions_website && create_if_block_21(ctx);
    	let if_block1 = /*university*/ ctx[6].application_fee && create_if_block_20(ctx);
    	let if_block2 = /*university*/ ctx[6].total_applicants && create_if_block_19(ctx);
    	let if_block3 = /*university*/ ctx[6].total_admissions && create_if_block_18(ctx);
    	let if_block4 = /*university*/ ctx[6].total_applicants && /*university*/ ctx[6].total_admissions && create_if_block_17(ctx);
    	let if_block5 = /*university*/ ctx[6].total_enrolled_applicants && create_if_block_16(ctx);
    	let if_block6 = /*university*/ ctx[6].admissions_yield && create_if_block_15(ctx);
    	let if_block7 = /*university*/ ctx[6].submitted_sat && create_if_block_14(ctx);
    	let if_block8 = /*university*/ ctx[6].sat_english_1q && /*university*/ ctx[6].sat_english_3q && create_if_block_13(ctx);
    	let if_block9 = /*university*/ ctx[6].sat_math_1q && /*university*/ ctx[6].sat_math_3q && create_if_block_12(ctx);
    	let if_block10 = /*university*/ ctx[6].sat_english_1q && /*university*/ ctx[6].sat_english_3q && /*university*/ ctx[6].sat_math_1q && /*university*/ ctx[6].sat_math_3q && create_if_block_11(ctx);
    	let if_block11 = /*university*/ ctx[6].submitted_act && create_if_block_10(ctx);
    	let if_block12 = /*university*/ ctx[6].act_composite_1q && /*university*/ ctx[6].act_composite_3q && create_if_block_9(ctx);
    	let if_block13 = /*university*/ ctx[6].act_english_1q && /*university*/ ctx[6].act_english_3q && create_if_block_8(ctx);
    	let if_block14 = /*university*/ ctx[6].act_math_1q && /*university*/ ctx[6].act_math_3q && create_if_block_7(ctx);

    	return {
    		c() {
    			if (if_block0) if_block0.c();
    			t0 = space();
    			if (if_block1) if_block1.c();
    			t1 = space();
    			h20 = element("h2");
    			h20.textContent = "Admission Factors";
    			t3 = space();
    			ul0 = element("ul");
    			li0 = element("li");
    			t4 = text("GPA: ");
    			t5 = text(t5_value);
    			t6 = space();
    			li1 = element("li");
    			t7 = text("Class rank: ");
    			t8 = text(t8_value);
    			t9 = space();
    			li2 = element("li");
    			t10 = text("Transcript: ");
    			t11 = text(t11_value);
    			t12 = space();
    			li3 = element("li");
    			t13 = text("Recommendations: ");
    			t14 = text(t14_value);
    			t15 = space();
    			li4 = element("li");
    			t16 = text("Test scores: ");
    			t17 = text(t17_value);
    			t18 = space();
    			li5 = element("li");
    			t19 = text("TOEFL: ");
    			t20 = text(t20_value);
    			t21 = space();
    			h21 = element("h2");
    			h21.textContent = "Admission statistics";
    			t23 = space();
    			ul1 = element("ul");
    			if (if_block2) if_block2.c();
    			t24 = space();
    			if (if_block3) if_block3.c();
    			t25 = space();
    			if (if_block4) if_block4.c();
    			t26 = space();
    			if (if_block5) if_block5.c();
    			t27 = space();
    			if (if_block6) if_block6.c();
    			t28 = space();
    			h3 = element("h3");
    			h3.textContent = "Test scores";
    			t30 = space();
    			h40 = element("h4");
    			h40.textContent = "SAT";
    			t32 = space();
    			ul2 = element("ul");
    			if (if_block7) if_block7.c();
    			t33 = space();
    			if (if_block8) if_block8.c();
    			t34 = space();
    			if (if_block9) if_block9.c();
    			t35 = space();
    			if (if_block10) if_block10.c();
    			t36 = space();
    			h41 = element("h4");
    			h41.textContent = "ACT";
    			t38 = space();
    			ul3 = element("ul");
    			if (if_block11) if_block11.c();
    			t39 = space();
    			if (if_block12) if_block12.c();
    			t40 = space();
    			if (if_block13) if_block13.c();
    			t41 = space();
    			if (if_block14) if_block14.c();
    		},
    		m(target, anchor) {
    			if (if_block0) if_block0.m(target, anchor);
    			insert(target, t0, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert(target, t1, anchor);
    			insert(target, h20, anchor);
    			insert(target, t3, anchor);
    			insert(target, ul0, anchor);
    			append(ul0, li0);
    			append(li0, t4);
    			append(li0, t5);
    			append(ul0, t6);
    			append(ul0, li1);
    			append(li1, t7);
    			append(li1, t8);
    			append(ul0, t9);
    			append(ul0, li2);
    			append(li2, t10);
    			append(li2, t11);
    			append(ul0, t12);
    			append(ul0, li3);
    			append(li3, t13);
    			append(li3, t14);
    			append(ul0, t15);
    			append(ul0, li4);
    			append(li4, t16);
    			append(li4, t17);
    			append(ul0, t18);
    			append(ul0, li5);
    			append(li5, t19);
    			append(li5, t20);
    			insert(target, t21, anchor);
    			insert(target, h21, anchor);
    			insert(target, t23, anchor);
    			insert(target, ul1, anchor);
    			if (if_block2) if_block2.m(ul1, null);
    			append(ul1, t24);
    			if (if_block3) if_block3.m(ul1, null);
    			append(ul1, t25);
    			if (if_block4) if_block4.m(ul1, null);
    			append(ul1, t26);
    			if (if_block5) if_block5.m(ul1, null);
    			append(ul1, t27);
    			if (if_block6) if_block6.m(ul1, null);
    			insert(target, t28, anchor);
    			insert(target, h3, anchor);
    			insert(target, t30, anchor);
    			insert(target, h40, anchor);
    			insert(target, t32, anchor);
    			insert(target, ul2, anchor);
    			if (if_block7) if_block7.m(ul2, null);
    			append(ul2, t33);
    			if (if_block8) if_block8.m(ul2, null);
    			append(ul2, t34);
    			if (if_block9) if_block9.m(ul2, null);
    			append(ul2, t35);
    			if (if_block10) if_block10.m(ul2, null);
    			insert(target, t36, anchor);
    			insert(target, h41, anchor);
    			insert(target, t38, anchor);
    			insert(target, ul3, anchor);
    			if (if_block11) if_block11.m(ul3, null);
    			append(ul3, t39);
    			if (if_block12) if_block12.m(ul3, null);
    			append(ul3, t40);
    			if (if_block13) if_block13.m(ul3, null);
    			append(ul3, t41);
    			if (if_block14) if_block14.m(ul3, null);
    		},
    		p(ctx, dirty) {
    			if (/*university*/ ctx[6].admissions_website) if_block0.p(ctx, dirty);
    			if (/*university*/ ctx[6].application_fee) if_block1.p(ctx, dirty);
    			if (/*university*/ ctx[6].total_applicants) if_block2.p(ctx, dirty);
    			if (/*university*/ ctx[6].total_admissions) if_block3.p(ctx, dirty);
    			if (/*university*/ ctx[6].total_applicants && /*university*/ ctx[6].total_admissions) if_block4.p(ctx, dirty);
    			if (/*university*/ ctx[6].total_enrolled_applicants) if_block5.p(ctx, dirty);
    			if (/*university*/ ctx[6].admissions_yield) if_block6.p(ctx, dirty);
    			if (/*university*/ ctx[6].submitted_sat) if_block7.p(ctx, dirty);
    			if (/*university*/ ctx[6].sat_english_1q && /*university*/ ctx[6].sat_english_3q) if_block8.p(ctx, dirty);
    			if (/*university*/ ctx[6].sat_math_1q && /*university*/ ctx[6].sat_math_3q) if_block9.p(ctx, dirty);
    			if (/*university*/ ctx[6].sat_english_1q && /*university*/ ctx[6].sat_english_3q && /*university*/ ctx[6].sat_math_1q && /*university*/ ctx[6].sat_math_3q) if_block10.p(ctx, dirty);
    			if (/*university*/ ctx[6].submitted_act) if_block11.p(ctx, dirty);
    			if (/*university*/ ctx[6].act_composite_1q && /*university*/ ctx[6].act_composite_3q) if_block12.p(ctx, dirty);
    			if (/*university*/ ctx[6].act_english_1q && /*university*/ ctx[6].act_english_3q) if_block13.p(ctx, dirty);
    			if (/*university*/ ctx[6].act_math_1q && /*university*/ ctx[6].act_math_3q) if_block14.p(ctx, dirty);
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach(t0);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach(t1);
    			if (detaching) detach(h20);
    			if (detaching) detach(t3);
    			if (detaching) detach(ul0);
    			if (detaching) detach(t21);
    			if (detaching) detach(h21);
    			if (detaching) detach(t23);
    			if (detaching) detach(ul1);
    			if (if_block2) if_block2.d();
    			if (if_block3) if_block3.d();
    			if (if_block4) if_block4.d();
    			if (if_block5) if_block5.d();
    			if (if_block6) if_block6.d();
    			if (detaching) detach(t28);
    			if (detaching) detach(h3);
    			if (detaching) detach(t30);
    			if (detaching) detach(h40);
    			if (detaching) detach(t32);
    			if (detaching) detach(ul2);
    			if (if_block7) if_block7.d();
    			if (if_block8) if_block8.d();
    			if (if_block9) if_block9.d();
    			if (if_block10) if_block10.d();
    			if (detaching) detach(t36);
    			if (detaching) detach(h41);
    			if (detaching) detach(t38);
    			if (detaching) detach(ul3);
    			if (if_block11) if_block11.d();
    			if (if_block12) if_block12.d();
    			if (if_block13) if_block13.d();
    			if (if_block14) if_block14.d();
    		}
    	};
    }

    // (91:30) 
    function create_if_block_1(ctx) {
    	let ul;
    	let t0;
    	let t1;
    	let t2;
    	let if_block0 = /*university*/ ctx[6].total_enrollment && create_if_block_5(ctx);
    	let if_block1 = /*university*/ ctx[6].undergrad_enrollment && create_if_block_4(ctx);
    	let if_block2 = /*university*/ ctx[6].student_to_faculty && create_if_block_3(ctx);
    	let if_block3 = /*university*/ ctx[6].graduation_rate && create_if_block_2(ctx);

    	return {
    		c() {
    			ul = element("ul");
    			if (if_block0) if_block0.c();
    			t0 = space();
    			if (if_block1) if_block1.c();
    			t1 = space();
    			if (if_block2) if_block2.c();
    			t2 = space();
    			if (if_block3) if_block3.c();
    		},
    		m(target, anchor) {
    			insert(target, ul, anchor);
    			if (if_block0) if_block0.m(ul, null);
    			append(ul, t0);
    			if (if_block1) if_block1.m(ul, null);
    			append(ul, t1);
    			if (if_block2) if_block2.m(ul, null);
    			append(ul, t2);
    			if (if_block3) if_block3.m(ul, null);
    		},
    		p(ctx, dirty) {
    			if (/*university*/ ctx[6].total_enrollment) if_block0.p(ctx, dirty);
    			if (/*university*/ ctx[6].undergrad_enrollment) if_block1.p(ctx, dirty);
    			if (/*university*/ ctx[6].student_to_faculty) if_block2.p(ctx, dirty);
    			if (/*university*/ ctx[6].graduation_rate) if_block3.p(ctx, dirty);
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(ul);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			if (if_block3) if_block3.d();
    		}
    	};
    }

    // (74:2) {#if tab === Tab.Weather}
    function create_if_block$1(ctx) {
    	let div;
    	let p0;
    	let t0_value = /*university*/ ctx[6].street_address + "";
    	let t0;
    	let t1;
    	let p1;
    	let t2_value = /*university*/ ctx[6].city + "";
    	let t2;
    	let t3;
    	let t4_value = /*university*/ ctx[6].state + "";
    	let t4;
    	let t5;
    	let t6_value = /*university*/ ctx[6].zip_code + "";
    	let t6;
    	let t7;
    	let h2;
    	let t9;
    	let await_block_anchor;
    	let current;

    	let info = {
    		ctx,
    		current: null,
    		token: null,
    		hasCatch: false,
    		pending: create_pending_block_1,
    		then: create_then_block_1,
    		catch: create_catch_block$2,
    		value: 7,
    		blocks: [,,,]
    	};

    	handle_promise(/*weather*/ ctx[7], info);

    	return {
    		c() {
    			div = element("div");
    			p0 = element("p");
    			t0 = text(t0_value);
    			t1 = space();
    			p1 = element("p");
    			t2 = text(t2_value);
    			t3 = text(", ");
    			t4 = text(t4_value);
    			t5 = space();
    			t6 = text(t6_value);
    			t7 = space();
    			h2 = element("h2");
    			h2.textContent = "Weather";
    			t9 = space();
    			await_block_anchor = empty();
    			info.block.c();
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, p0);
    			append(p0, t0);
    			append(div, t1);
    			append(div, p1);
    			append(p1, t2);
    			append(p1, t3);
    			append(p1, t4);
    			append(p1, t5);
    			append(p1, t6);
    			insert(target, t7, anchor);
    			insert(target, h2, anchor);
    			insert(target, t9, anchor);
    			insert(target, await_block_anchor, anchor);
    			info.block.m(target, info.anchor = anchor);
    			info.mount = () => await_block_anchor.parentNode;
    			info.anchor = await_block_anchor;
    			current = true;
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			update_await_block_branch(info, ctx, dirty);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(info.block);
    			current = true;
    		},
    		o(local) {
    			for (let i = 0; i < 3; i += 1) {
    				const block = info.blocks[i];
    				transition_out(block);
    			}

    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			if (detaching) detach(t7);
    			if (detaching) detach(h2);
    			if (detaching) detach(t9);
    			if (detaching) detach(await_block_anchor);
    			info.block.d(detaching);
    			info.token = null;
    			info = null;
    		}
    	};
    }

    // (215:6) {#if university.price_in_district}
    function create_if_block_25(ctx) {
    	let li;
    	let t0;
    	let t1_value = /*university*/ ctx[6].price_in_district + "";
    	let t1;

    	return {
    		c() {
    			li = element("li");
    			t0 = text("In-district price: $");
    			t1 = text(t1_value);
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, t0);
    			append(li, t1);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(li);
    		}
    	};
    }

    // (218:6) {#if university.price_in_state}
    function create_if_block_24(ctx) {
    	let li;
    	let t0;
    	let t1_value = /*university*/ ctx[6].price_in_state + "";
    	let t1;

    	return {
    		c() {
    			li = element("li");
    			t0 = text("In-state price: $");
    			t1 = text(t1_value);
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, t0);
    			append(li, t1);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(li);
    		}
    	};
    }

    // (221:6) {#if university.price_out_of_state}
    function create_if_block_23(ctx) {
    	let li;
    	let t0;
    	let t1_value = /*university*/ ctx[6].price_out_of_state + "";
    	let t1;

    	return {
    		c() {
    			li = element("li");
    			t0 = text("Out-of-state price (or price of a private school): $");
    			t1 = text(t1_value);
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, t0);
    			append(li, t1);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(li);
    		}
    	};
    }

    // (107:4) {#if university.admissions_website}
    function create_if_block_21(ctx) {
    	let p;
    	let a;
    	let t;

    	return {
    		c() {
    			p = element("p");
    			a = element("a");
    			t = text("Admissions office website");
    			attr(a, "href", normalizeUrl(/*university*/ ctx[6].admissions_website));
    			attr(a, "target", "_blank");
    		},
    		m(target, anchor) {
    			insert(target, p, anchor);
    			append(p, a);
    			append(a, t);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(p);
    		}
    	};
    }

    // (114:4) {#if university.application_fee}
    function create_if_block_20(ctx) {
    	let p;
    	let t0;
    	let t1_value = /*university*/ ctx[6].application_fee + "";
    	let t1;

    	return {
    		c() {
    			p = element("p");
    			t0 = text("Application fee: $");
    			t1 = text(t1_value);
    		},
    		m(target, anchor) {
    			insert(target, p, anchor);
    			append(p, t0);
    			append(p, t1);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(p);
    		}
    	};
    }

    // (138:6) {#if university.total_applicants}
    function create_if_block_19(ctx) {
    	let li;
    	let t0;
    	let t1_value = /*university*/ ctx[6].total_applicants + "";
    	let t1;

    	return {
    		c() {
    			li = element("li");
    			t0 = text("Total applicants: ");
    			t1 = text(t1_value);
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, t0);
    			append(li, t1);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(li);
    		}
    	};
    }

    // (141:6) {#if university.total_admissions}
    function create_if_block_18(ctx) {
    	let li;
    	let t0;
    	let t1_value = /*university*/ ctx[6].total_admissions + "";
    	let t1;

    	return {
    		c() {
    			li = element("li");
    			t0 = text("Total admitted: ");
    			t1 = text(t1_value);
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, t0);
    			append(li, t1);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(li);
    		}
    	};
    }

    // (144:6) {#if university.total_applicants && university.total_admissions}
    function create_if_block_17(ctx) {
    	let li;
    	let t0;
    	let t1_value = (100 * /*university*/ ctx[6].total_admissions / /*university*/ ctx[6].total_applicants).toFixed(1) + "";
    	let t1;
    	let t2;

    	return {
    		c() {
    			li = element("li");
    			t0 = text("Acceptance rate: ");
    			t1 = text(t1_value);
    			t2 = text("%");
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, t0);
    			append(li, t1);
    			append(li, t2);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(li);
    		}
    	};
    }

    // (152:6) {#if university.total_enrolled_applicants}
    function create_if_block_16(ctx) {
    	let li;
    	let t0;
    	let t1_value = /*university*/ ctx[6].total_enrolled_applicants + "";
    	let t1;

    	return {
    		c() {
    			li = element("li");
    			t0 = text("Total enrolled: ");
    			t1 = text(t1_value);
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, t0);
    			append(li, t1);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(li);
    		}
    	};
    }

    // (155:6) {#if university.admissions_yield}
    function create_if_block_15(ctx) {
    	let li;
    	let t0;
    	let t1_value = /*university*/ ctx[6].admissions_yield + "";
    	let t1;
    	let t2;

    	return {
    		c() {
    			li = element("li");
    			t0 = text("Yield rate: ");
    			t1 = text(t1_value);
    			t2 = text("%");
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, t0);
    			append(li, t1);
    			append(li, t2);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(li);
    		}
    	};
    }

    // (162:6) {#if university.submitted_sat}
    function create_if_block_14(ctx) {
    	let li;
    	let t0;
    	let t1_value = /*university*/ ctx[6].submitted_sat + "";
    	let t1;
    	let t2;

    	return {
    		c() {
    			li = element("li");
    			t0 = text("(Enrolled) students who submitted SAT scores: ");
    			t1 = text(t1_value);
    			t2 = text("%");
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, t0);
    			append(li, t1);
    			append(li, t2);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(li);
    		}
    	};
    }

    // (167:6) {#if university.sat_english_1q && university.sat_english_3q}
    function create_if_block_13(ctx) {
    	let li;
    	let t0;
    	let t1_value = /*university*/ ctx[6].sat_english_1q + "";
    	let t1;
    	let t2;
    	let t3_value = /*university*/ ctx[6].sat_english_3q + "";
    	let t3;

    	return {
    		c() {
    			li = element("li");
    			t0 = text("English: first quartile: ");
    			t1 = text(t1_value);
    			t2 = text(", third quartile: ");
    			t3 = text(t3_value);
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, t0);
    			append(li, t1);
    			append(li, t2);
    			append(li, t3);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(li);
    		}
    	};
    }

    // (172:6) {#if university.sat_math_1q && university.sat_math_3q}
    function create_if_block_12(ctx) {
    	let li;
    	let t0;
    	let t1_value = /*university*/ ctx[6].sat_math_1q + "";
    	let t1;
    	let t2;
    	let t3_value = /*university*/ ctx[6].sat_math_3q + "";
    	let t3;

    	return {
    		c() {
    			li = element("li");
    			t0 = text("Math: first quartile: ");
    			t1 = text(t1_value);
    			t2 = text(", third quartile: ");
    			t3 = text(t3_value);
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, t0);
    			append(li, t1);
    			append(li, t2);
    			append(li, t3);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(li);
    		}
    	};
    }

    // (177:6) {#if university.sat_english_1q && university.sat_english_3q && university.sat_math_1q && university.sat_math_3q}
    function create_if_block_11(ctx) {
    	let li;
    	let t0;
    	let t1_value = /*university*/ ctx[6].sat_english_1q + /*university*/ ctx[6].sat_math_1q + "";
    	let t1;
    	let t2;
    	let t3_value = /*university*/ ctx[6].sat_english_3q + /*university*/ ctx[6].sat_math_3q + "";
    	let t3;

    	return {
    		c() {
    			li = element("li");
    			t0 = text("Total: first quartile: ");
    			t1 = text(t1_value);
    			t2 = text(", third quartile: ");
    			t3 = text(t3_value);
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, t0);
    			append(li, t1);
    			append(li, t2);
    			append(li, t3);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(li);
    		}
    	};
    }

    // (187:6) {#if university.submitted_act}
    function create_if_block_10(ctx) {
    	let li;
    	let t0;
    	let t1_value = /*university*/ ctx[6].submitted_act + "";
    	let t1;
    	let t2;

    	return {
    		c() {
    			li = element("li");
    			t0 = text("(Enrolled) students who submitted ACT scores: ");
    			t1 = text(t1_value);
    			t2 = text("%");
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, t0);
    			append(li, t1);
    			append(li, t2);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(li);
    		}
    	};
    }

    // (192:6) {#if university.act_composite_1q && university.act_composite_3q}
    function create_if_block_9(ctx) {
    	let li;
    	let t0;
    	let t1_value = /*university*/ ctx[6].act_composite_1q + "";
    	let t1;
    	let t2;
    	let t3_value = /*university*/ ctx[6].act_composite_3q + "";
    	let t3;

    	return {
    		c() {
    			li = element("li");
    			t0 = text("Composite: first quartile: ");
    			t1 = text(t1_value);
    			t2 = text(", third\n          quartile: ");
    			t3 = text(t3_value);
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, t0);
    			append(li, t1);
    			append(li, t2);
    			append(li, t3);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(li);
    		}
    	};
    }

    // (198:6) {#if university.act_english_1q && university.act_english_3q}
    function create_if_block_8(ctx) {
    	let li;
    	let t0;
    	let t1_value = /*university*/ ctx[6].act_english_1q + "";
    	let t1;
    	let t2;
    	let t3_value = /*university*/ ctx[6].act_english_3q + "";
    	let t3;

    	return {
    		c() {
    			li = element("li");
    			t0 = text("English: first quartile: ");
    			t1 = text(t1_value);
    			t2 = text(", third quartile: ");
    			t3 = text(t3_value);
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, t0);
    			append(li, t1);
    			append(li, t2);
    			append(li, t3);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(li);
    		}
    	};
    }

    // (203:6) {#if university.act_math_1q && university.act_math_3q}
    function create_if_block_7(ctx) {
    	let li;
    	let t0;
    	let t1_value = /*university*/ ctx[6].act_math_1q + "";
    	let t1;
    	let t2;
    	let t3_value = /*university*/ ctx[6].act_math_3q + "";
    	let t3;

    	return {
    		c() {
    			li = element("li");
    			t0 = text("Math: first quartile: ");
    			t1 = text(t1_value);
    			t2 = text(", third quartile: ");
    			t3 = text(t3_value);
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, t0);
    			append(li, t1);
    			append(li, t2);
    			append(li, t3);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(li);
    		}
    	};
    }

    // (93:6) {#if university.total_enrollment}
    function create_if_block_5(ctx) {
    	let li;
    	let t0_value = /*university*/ ctx[6].total_enrollment + "";
    	let t0;
    	let t1;

    	return {
    		c() {
    			li = element("li");
    			t0 = text(t0_value);
    			t1 = text(" total students");
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, t0);
    			append(li, t1);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(li);
    		}
    	};
    }

    // (96:6) {#if university.undergrad_enrollment}
    function create_if_block_4(ctx) {
    	let li;
    	let t0_value = /*university*/ ctx[6].undergrad_enrollment + "";
    	let t0;
    	let t1;

    	return {
    		c() {
    			li = element("li");
    			t0 = text(t0_value);
    			t1 = text(" undergraduates");
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, t0);
    			append(li, t1);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(li);
    		}
    	};
    }

    // (99:6) {#if university.student_to_faculty}
    function create_if_block_3(ctx) {
    	let li;
    	let t0;
    	let t1_value = /*university*/ ctx[6].student_to_faculty + "";
    	let t1;
    	let t2;

    	return {
    		c() {
    			li = element("li");
    			t0 = text("Student-to-faculty ratio: ");
    			t1 = text(t1_value);
    			t2 = text(":1");
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, t0);
    			append(li, t1);
    			append(li, t2);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(li);
    		}
    	};
    }

    // (102:6) {#if university.graduation_rate}
    function create_if_block_2(ctx) {
    	let li;
    	let t0;
    	let t1_value = /*university*/ ctx[6].student_to_faculty + "";
    	let t1;
    	let t2;

    	return {
    		c() {
    			li = element("li");
    			t0 = text("Total graduation rate: ");
    			t1 = text(t1_value);
    			t2 = text("%");
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, t0);
    			append(li, t1);
    			append(li, t2);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(li);
    		}
    	};
    }

    // (1:0) <script lang="ts">import WeatherInfo from "../components/WeatherInfo.svelte"; import { isAuthed, authedFetch, user }
    function create_catch_block$2(ctx) {
    	return {
    		c: noop,
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};
    }

    // (82:4) {:then weather}
    function create_then_block_1(ctx) {
    	let ol;
    	let current;
    	let each_value = /*weather*/ ctx[7];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	return {
    		c() {
    			ol = element("ol");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}
    		},
    		m(target, anchor) {
    			insert(target, ol, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ol, null);
    			}

    			current = true;
    		},
    		p(ctx, dirty) {
    			if (dirty & /*weather*/ 128) {
    				each_value = /*weather*/ ctx[7];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(ol, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(ol);
    			destroy_each(each_blocks, detaching);
    		}
    	};
    }

    // (84:8) {#each weather as weather}
    function create_each_block$1(ctx) {
    	let li;
    	let weatherinfo;
    	let t;
    	let current;
    	weatherinfo = new WeatherInfo({ props: { weather: /*weather*/ ctx[7] } });

    	return {
    		c() {
    			li = element("li");
    			create_component(weatherinfo.$$.fragment);
    			t = space();
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			mount_component(weatherinfo, li, null);
    			append(li, t);
    			current = true;
    		},
    		p: noop,
    		i(local) {
    			if (current) return;
    			transition_in(weatherinfo.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(weatherinfo.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(li);
    			destroy_component(weatherinfo);
    		}
    	};
    }

    // (80:20)        <p>Loading weather...</p>     {:then weather}
    function create_pending_block_1(ctx) {
    	let p;

    	return {
    		c() {
    			p = element("p");
    			p.textContent = "Loading weather...";
    		},
    		m(target, anchor) {
    			insert(target, p, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(p);
    		}
    	};
    }

    // (46:19)    <p>Loading university info...</p> {:then university}
    function create_pending_block$2(ctx) {
    	let p;

    	return {
    		c() {
    			p = element("p");
    			p.textContent = "Loading university info...";
    		},
    		m(target, anchor) {
    			insert(target, p, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(p);
    		}
    	};
    }

    function create_fragment$4(ctx) {
    	let await_block_anchor;
    	let current;

    	let info = {
    		ctx,
    		current: null,
    		token: null,
    		hasCatch: false,
    		pending: create_pending_block$2,
    		then: create_then_block$2,
    		catch: create_catch_block_2,
    		value: 6,
    		blocks: [,,,]
    	};

    	handle_promise(/*university*/ ctx[6], info);

    	return {
    		c() {
    			await_block_anchor = empty();
    			info.block.c();
    		},
    		m(target, anchor) {
    			insert(target, await_block_anchor, anchor);
    			info.block.m(target, info.anchor = anchor);
    			info.mount = () => await_block_anchor.parentNode;
    			info.anchor = await_block_anchor;
    			current = true;
    		},
    		p(new_ctx, [dirty]) {
    			ctx = new_ctx;
    			update_await_block_branch(info, ctx, dirty);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(info.block);
    			current = true;
    		},
    		o(local) {
    			for (let i = 0; i < 3; i += 1) {
    				const block = info.blocks[i];
    				transition_out(block);
    			}

    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(await_block_anchor);
    			info.block.d(detaching);
    			info.token = null;
    			info = null;
    		}
    	};
    }

    function considerationString(consideration) {
    	switch (consideration) {
    		case 0:
    			return "Unspecified";
    		case 1:
    			return "Required";
    		case 2:
    			return "Recommended";
    		case 3:
    			return "Considered but not required";
    		case 4:
    			return "Neither required nor recommended";
    	}
    }

    function normalizeUrl(url) {
    	if (url.startsWith("http")) return url;
    	return "https://" + url;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let $path;
    	let $user;
    	let $authedFetch;
    	let $isAuthed;
    	component_subscribe($$self, path, $$value => $$invalidate(12, $path = $$value));
    	component_subscribe($$self, user, $$value => $$invalidate(3, $user = $$value));
    	component_subscribe($$self, authedFetch, $$value => $$invalidate(13, $authedFetch = $$value));
    	component_subscribe($$self, isAuthed, $$value => $$invalidate(4, $isAuthed = $$value));
    	var Tab;

    	(function (Tab) {
    		Tab[Tab["Weather"] = 0] = "Weather";
    		Tab[Tab["Stats"] = 1] = "Stats";
    		Tab[Tab["Admissions"] = 2] = "Admissions";
    		Tab[Tab["Costs"] = 3] = "Costs";
    	})(Tab || (Tab = {}));

    	let { id } = $$props;
    	let university = fetch(`/api/university/${id}`).then(res => res.json());
    	let weather = fetch(`/api/university/${id}/weather`).then(res => res.json());
    	let tab = Tab.Weather;

    	async function updateDashboard() {
    		await $authedFetch("/api/user/me/universities", {
    			method: (await $user).universities.includes(id)
    			? "DELETE"
    			: "PUT",
    			headers: { "Content-Type": "application/json" },
    			body: JSON.stringify({ id })
    		});

    		set_store_value(path, $path = "/dashboard", $path);
    	}

    	const click_handler = () => $$invalidate(2, tab = Tab.Weather);
    	const click_handler_1 = () => $$invalidate(2, tab = Tab.Stats);
    	const click_handler_2 = () => $$invalidate(2, tab = Tab.Admissions);
    	const click_handler_3 = () => $$invalidate(2, tab = Tab.Costs);

    	$$self.$$set = $$props => {
    		if ('id' in $$props) $$invalidate(0, id = $$props.id);
    	};

    	return [
    		id,
    		Tab,
    		tab,
    		$user,
    		$isAuthed,
    		updateDashboard,
    		university,
    		weather,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3
    	];
    }

    class UniversityInfo extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$3, create_fragment$4, safe_not_equal, { id: 0 });
    	}
    }

    /* src/Router.svelte generated by Svelte v3.49.0 */

    function create_fragment$3(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	const switch_instance_spread_levels = [/*props*/ ctx[1]];
    	var switch_value = /*currentComponent*/ ctx[0];

    	function switch_props(ctx) {
    		let switch_instance_props = {};

    		for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
    			switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
    		}

    		return { props: switch_instance_props };
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props());
    	}

    	return {
    		c() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    		},
    		m(target, anchor) {
    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			const switch_instance_changes = (dirty & /*props*/ 2)
    			? get_spread_update(switch_instance_spread_levels, [get_spread_object(/*props*/ ctx[1])])
    			: {};

    			if (switch_value !== (switch_value = /*currentComponent*/ ctx[0])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props());
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			} else if (switch_value) {
    				switch_instance.$set(switch_instance_changes);
    			}
    		},
    		i(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};
    }

    const path = writable(window.location.pathname);
    const PREFIX = "";

    function isOptions(component) {
    	return Object.hasOwn(component, "component");
    }

    function instance$2($$self, $$props, $$invalidate) {
    	const routes = {
    		"/university/add": AddUniversity,
    		"/university/(?<id>\\d+)": {
    			component: UniversityInfo,
    			transform: ({ id }) => ({ id: Number.parseInt(id) })
    		},
    		"/user/me": UserInfo,
    		"/user/(?<mode>(login)|(create))": Login,
    		"/(dashboard)?": Dashboard
    	};

    	const compiled = Object.entries(routes).map(([route, component]) => [
    		new RegExp("^" + PREFIX + route + "$"),
    		isOptions(component) ? component : { component }
    	]);

    	let { defaultComponent } = $$props;
    	let currentComponent = defaultComponent;
    	let props = {};

    	window.onpopstate = () => {
    		updateRoute(window.location.pathname);
    	};

    	path.subscribe(path => {
    		history.pushState({}, "", path);
    		updateRoute(path);
    	});

    	function updateRoute(path) {
    		for (const [route, component] of compiled) {
    			let match = path.match(route);

    			if (match) {
    				$$invalidate(1, props = match.groups);
    				if (component.transform) $$invalidate(1, props = component.transform(props));
    				$$invalidate(0, currentComponent = component.component);
    				return;
    			}
    		}

    		$$invalidate(1, props = {});
    		$$invalidate(0, currentComponent = defaultComponent);
    	}

    	updateRoute(window.location.pathname);

    	$$self.$$set = $$props => {
    		if ('defaultComponent' in $$props) $$invalidate(2, defaultComponent = $$props.defaultComponent);
    	};

    	return [currentComponent, props, defaultComponent];
    }

    class Router extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$2, create_fragment$3, safe_not_equal, { defaultComponent: 2 });
    	}
    }

    /* src/pages/UserInfo.svelte generated by Svelte v3.49.0 */

    function create_catch_block$1(ctx) {
    	return { c: noop, m: noop, p: noop, d: noop };
    }

    // (77:0) {:then user}
    function create_then_block$1(ctx) {
    	let t0;
    	let t1_value = /*user*/ ctx[4].name + "";
    	let t1;

    	return {
    		c() {
    			t0 = text("Hello, ");
    			t1 = text(t1_value);
    		},
    		m(target, anchor) {
    			insert(target, t0, anchor);
    			insert(target, t1, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*$user*/ 1 && t1_value !== (t1_value = /*user*/ ctx[4].name + "")) set_data(t1, t1_value);
    		},
    		d(detaching) {
    			if (detaching) detach(t0);
    			if (detaching) detach(t1);
    		}
    	};
    }

    // (75:14)    Loading user... {:then user}
    function create_pending_block$1(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Loading user...");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    function create_fragment$2(ctx) {
    	let await_block_anchor;
    	let promise;

    	let info = {
    		ctx,
    		current: null,
    		token: null,
    		hasCatch: false,
    		pending: create_pending_block$1,
    		then: create_then_block$1,
    		catch: create_catch_block$1,
    		value: 4
    	};

    	handle_promise(promise = /*$user*/ ctx[0], info);

    	return {
    		c() {
    			await_block_anchor = empty();
    			info.block.c();
    		},
    		m(target, anchor) {
    			insert(target, await_block_anchor, anchor);
    			info.block.m(target, info.anchor = anchor);
    			info.mount = () => await_block_anchor.parentNode;
    			info.anchor = await_block_anchor;
    		},
    		p(new_ctx, [dirty]) {
    			ctx = new_ctx;
    			info.ctx = ctx;

    			if (dirty & /*$user*/ 1 && promise !== (promise = /*$user*/ ctx[0]) && handle_promise(promise, info)) ; else {
    				update_await_block_branch(info, ctx, dirty);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(await_block_anchor);
    			info.block.d(detaching);
    			info.token = null;
    			info = null;
    		}
    	};
    }

    let jwt = localStorage.getItem("jwt");
    let exps = localStorage.getItem("exp");
    let exp = exps ? Number.parseInt(exps) : null;
    const auth = writable(jwt ? { jwt, exp } : null);
    const isAuthed = derived(auth, val => !!val, !!jwt);

    auth.subscribe(val => {
    	if (val) {
    		localStorage.setItem("jwt", val.jwt);
    		localStorage.setItem("exp", val.exp.toString());
    	} else {
    		localStorage.removeItem("jwt");
    		localStorage.removeItem("exp");
    	}
    });

    const authedFetch = derived(auth, val => {
    	if (val) {
    		return async (url, init = {}) => {
    			if (!init.headers) init.headers = {};
    			init.headers["Authorization"] = `Bearer ${val.jwt}`;
    			let res = await fetch(url, init);

    			if (res.status === 401) {
    				auth.set(null);
    			}

    			return res;
    		};
    	} else {
    		return (_, __ = {}) => {
    			throw new Error("not authed");
    		};
    	}
    });

    let setUser = user => void user;

    const user = derived(auth, (val, set) => {
    	setUser = set;
    	if (!val) return null;
    	updateUser(val.jwt);
    });

    async function fetchUser(jwt) {
    	if (!jwt) return null;

    	let res = await fetch("/api/user/me", {
    		headers: { Authorization: `Bearer ${jwt}` }
    	});

    	if (res.status === 401) {
    		auth.set(null);
    		return null;
    	}

    	return res.json();
    }

    function updateUser(jwt) {
    	setUser(fetchUser(jwt));
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let $auth,
    		$$unsubscribe_auth = noop;

    	let $user,
    		$$unsubscribe_user = noop;

    	let $path;

    	let $isAuthed,
    		$$unsubscribe_isAuthed = noop;

    	component_subscribe($$self, auth, $$value => $$invalidate(2, $auth = $$value));
    	component_subscribe($$self, user, $$value => $$invalidate(0, $user = $$value));
    	component_subscribe($$self, path, $$value => $$invalidate(3, $path = $$value));
    	component_subscribe($$self, isAuthed, $$value => $$invalidate(1, $isAuthed = $$value));
    	$$self.$$.on_destroy.push(() => $$unsubscribe_auth());
    	$$self.$$.on_destroy.push(() => $$unsubscribe_user());
    	$$self.$$.on_destroy.push(() => $$unsubscribe_isAuthed());

    	onMount(async () => {
    		if (!await $user) {
    			updateUser($auth.jwt);
    		}
    	});

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$isAuthed*/ 2) {
    			if (!$isAuthed) {
    				set_store_value(auth, $auth = null, $auth);
    				set_store_value(path, $path = "/user/login", $path);
    			}
    		}
    	};

    	return [$user, $isAuthed];
    }

    class UserInfo extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$2, safe_not_equal, {});
    	}
    }

    /* src/pages/Dashboard.svelte generated by Svelte v3.49.0 */

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[8] = list[i];
    	return child_ctx;
    }

    // (1:0) <script lang="ts">import { isAuthed, authedFetch, user }
    function create_catch_block(ctx) {
    	return {
    		c: noop,
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};
    }

    // (17:0) {:then user}
    function create_then_block(ctx) {
    	let h2;
    	let t0;
    	let t1_value = /*user*/ ctx[7].name + "";
    	let t1;
    	let t2;
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block, create_else_block];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (!/*universities*/ ctx[0]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	return {
    		c() {
    			h2 = element("h2");
    			t0 = text("Good morning, ");
    			t1 = text(t1_value);
    			t2 = space();
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			insert(target, h2, anchor);
    			append(h2, t0);
    			append(h2, t1);
    			insert(target, t2, anchor);
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			if ((!current || dirty & /*$user*/ 4) && t1_value !== (t1_value = /*user*/ ctx[7].name + "")) set_data(t1, t1_value);
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(h2);
    			if (detaching) detach(t2);
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    // (21:2) {:else}
    function create_else_block(ctx) {
    	let ul;
    	let li;
    	let button;
    	let t1;
    	let current;
    	let mounted;
    	let dispose;
    	let each_value = /*universities*/ ctx[0];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	return {
    		c() {
    			ul = element("ul");
    			li = element("li");
    			button = element("button");
    			button.textContent = "Add";
    			t1 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}
    		},
    		m(target, anchor) {
    			insert(target, ul, anchor);
    			append(ul, li);
    			append(li, button);
    			append(ul, t1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen(button, "click", /*click_handler*/ ctx[4]);
    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty & /*$path, universities*/ 3) {
    				each_value = /*universities*/ ctx[0];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(ul, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(ul);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (19:2) {#if !universities}
    function create_if_block(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Loading universities...");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (26:6) {#each universities as university}
    function create_each_block(ctx) {
    	let li;
    	let weatherinfo;
    	let t0;
    	let button;
    	let t2;
    	let current;
    	let mounted;
    	let dispose;

    	weatherinfo = new WeatherInfo({
    			props: {
    				weather: /*university*/ ctx[8].weather,
    				name: /*university*/ ctx[8].name
    			}
    		});

    	function click_handler_1() {
    		return /*click_handler_1*/ ctx[5](/*university*/ ctx[8]);
    	}

    	return {
    		c() {
    			li = element("li");
    			create_component(weatherinfo.$$.fragment);
    			t0 = space();
    			button = element("button");
    			button.textContent = "Info";
    			t2 = space();
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			mount_component(weatherinfo, li, null);
    			append(li, t0);
    			append(li, button);
    			append(li, t2);
    			current = true;

    			if (!mounted) {
    				dispose = listen(button, "click", click_handler_1);
    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			const weatherinfo_changes = {};
    			if (dirty & /*universities*/ 1) weatherinfo_changes.weather = /*university*/ ctx[8].weather;
    			if (dirty & /*universities*/ 1) weatherinfo_changes.name = /*university*/ ctx[8].name;
    			weatherinfo.$set(weatherinfo_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(weatherinfo.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(weatherinfo.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(li);
    			destroy_component(weatherinfo);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (15:14)    Loading dashboard... {:then user}
    function create_pending_block(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Loading dashboard...");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    function create_fragment$1(ctx) {
    	let await_block_anchor;
    	let promise;
    	let current;

    	let info = {
    		ctx,
    		current: null,
    		token: null,
    		hasCatch: false,
    		pending: create_pending_block,
    		then: create_then_block,
    		catch: create_catch_block,
    		value: 7,
    		blocks: [,,,]
    	};

    	handle_promise(promise = /*$user*/ ctx[2], info);

    	return {
    		c() {
    			await_block_anchor = empty();
    			info.block.c();
    		},
    		m(target, anchor) {
    			insert(target, await_block_anchor, anchor);
    			info.block.m(target, info.anchor = anchor);
    			info.mount = () => await_block_anchor.parentNode;
    			info.anchor = await_block_anchor;
    			current = true;
    		},
    		p(new_ctx, [dirty]) {
    			ctx = new_ctx;
    			info.ctx = ctx;

    			if (dirty & /*$user*/ 4 && promise !== (promise = /*$user*/ ctx[2]) && handle_promise(promise, info)) ; else {
    				update_await_block_branch(info, ctx, dirty);
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(info.block);
    			current = true;
    		},
    		o(local) {
    			for (let i = 0; i < 3; i += 1) {
    				const block = info.blocks[i];
    				transition_out(block);
    			}

    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(await_block_anchor);
    			info.block.d(detaching);
    			info.token = null;
    			info = null;
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let $authedFetch;
    	let $path;
    	let $isAuthed;
    	let $user;
    	component_subscribe($$self, authedFetch, $$value => $$invalidate(6, $authedFetch = $$value));
    	component_subscribe($$self, path, $$value => $$invalidate(1, $path = $$value));
    	component_subscribe($$self, isAuthed, $$value => $$invalidate(3, $isAuthed = $$value));
    	component_subscribe($$self, user, $$value => $$invalidate(2, $user = $$value));
    	let universities = null;

    	onMount(async () => {
    		let univs = await (await $authedFetch("/api/user/me/universities")).json();

    		$$invalidate(0, universities = await Promise.all(univs.map(async university => Object.assign(
    			{
    				weather: (await (await fetch(`/api/university/${university.id}/weather`)).json())[0]
    			},
    			university
    		))));
    	});

    	const click_handler = () => set_store_value(path, $path = "/university/add", $path);
    	const click_handler_1 = university => set_store_value(path, $path = `/university/${university.id}`, $path);

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$isAuthed*/ 8) {
    			if (!$isAuthed) {
    				set_store_value(path, $path = "/user/login", $path);
    			}
    		}
    	};

    	return [universities, $path, $user, $isAuthed, click_handler, click_handler_1];
    }

    class Dashboard extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment$1, safe_not_equal, {});
    	}
    }

    /* src/App.svelte generated by Svelte v3.49.0 */

    function create_fragment(ctx) {
    	let router;
    	let current;
    	router = new Router({ props: { defaultComponent: Dashboard } });

    	return {
    		c() {
    			create_component(router.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(router, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i(local) {
    			if (current) return;
    			transition_in(router.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(router.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(router, detaching);
    		}
    	};
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment, safe_not_equal, {});
    	}
    }

    var index = new App({ target: document.body });

    return index;

})();
