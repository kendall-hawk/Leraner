// js/polyfills/map-set.js - iOS兼容版Map/Set Polyfill
// 🚀 Map和Set完整实现，确保iOS Safari 9+兼容性

(function(global) {
    'use strict';

    // 检查是否需要Map polyfill
    var needsMapPolyfill = (function() {
        if (typeof Map === 'undefined') return true;
        
        // 检查Map是否完整支持
        try {
            var testMap = new Map([['key', 'value']]);
            return !(testMap.has('key') && testMap.get('key') === 'value' && 
                    testMap.size === 1 && typeof testMap.forEach === 'function');
        } catch (e) {
            return true;
        }
    })();

    // 检查是否需要Set polyfill
    var needsSetPolyfill = (function() {
        if (typeof Set === 'undefined') return true;
        
        // 检查Set是否完整支持
        try {
            var testSet = new Set(['value']);
            return !(testSet.has('value') && testSet.size === 1 && 
                    typeof testSet.forEach === 'function');
        } catch (e) {
            return true;
        }
    })();

    /**
     * 🎯 Map Polyfill - 完整实现
     * 功能：ES6 Map规范完整实现
     * 兼容：iOS Safari 9+, Android 4.4+
     */
    if (needsMapPolyfill) {
        function MapPolyfill(iterable) {
            this._keys = [];
            this._values = [];
            this.size = 0;
            
            // 处理可迭代对象初始化
            if (iterable != null) {
                if (typeof iterable[Symbol.iterator] === 'function') {
                    var iterator = iterable[Symbol.iterator]();
                    var step;
                    while (!(step = iterator.next()).done) {
                        var entry = step.value;
                        if (entry == null || typeof entry !== 'object') {
                            throw new TypeError('Iterator value is not an entry object');
                        }
                        this.set(entry[0], entry[1]);
                    }
                } else if (Array.isArray(iterable)) {
                    for (var i = 0; i < iterable.length; i++) {
                        var entry = iterable[i];
                        if (entry == null || typeof entry !== 'object') {
                            throw new TypeError('Iterator value is not an entry object');
                        }
                        this.set(entry[0], entry[1]);
                    }
                } else {
                    throw new TypeError('Map constructor requires an iterable object');
                }
            }
        }
        
        // Map.prototype.set
        MapPolyfill.prototype.set = function(key, value) {
            var index = this._indexOf(key);
            if (index >= 0) {
                this._values[index] = value;
            } else {
                this._keys.push(key);
                this._values.push(value);
                this.size++;
            }
            return this;
        };
        
        // Map.prototype.get
        MapPolyfill.prototype.get = function(key) {
            var index = this._indexOf(key);
            return index >= 0 ? this._values[index] : undefined;
        };
        
        // Map.prototype.has
        MapPolyfill.prototype.has = function(key) {
            return this._indexOf(key) >= 0;
        };
        
        // Map.prototype.delete
        MapPolyfill.prototype.delete = function(key) {
            var index = this._indexOf(key);
            if (index >= 0) {
                this._keys.splice(index, 1);
                this._values.splice(index, 1);
                this.size--;
                return true;
            }
            return false;
        };
        
        // Map.prototype.clear
        MapPolyfill.prototype.clear = function() {
            this._keys.length = 0;
            this._values.length = 0;
            this.size = 0;
        };
        
        // Map.prototype.forEach
        MapPolyfill.prototype.forEach = function(callback, thisArg) {
            if (typeof callback !== 'function') {
                throw new TypeError('Callback function required');
            }
            
            for (var i = 0; i < this._keys.length; i++) {
                callback.call(thisArg, this._values[i], this._keys[i], this);
            }
        };
        
        // Map.prototype.keys
        MapPolyfill.prototype.keys = function() {
            return new MapIterator(this._keys.slice(), 'keys');
        };
        
        // Map.prototype.values
        MapPolyfill.prototype.values = function() {
            return new MapIterator(this._values.slice(), 'values');
        };
        
        // Map.prototype.entries
        MapPolyfill.prototype.entries = function() {
            var entries = [];
            for (var i = 0; i < this._keys.length; i++) {
                entries.push([this._keys[i], this._values[i]]);
            }
            return new MapIterator(entries, 'entries');
        };
        
        // Map.prototype[Symbol.iterator]
        MapPolyfill.prototype[Symbol.iterator] = MapPolyfill.prototype.entries;
        
        // 私有方法：查找索引
        MapPolyfill.prototype._indexOf = function(key) {
            // 处理NaN的特殊情况
            if (key !== key) { // isNaN
                for (var i = 0; i < this._keys.length; i++) {
                    if (this._keys[i] !== this._keys[i]) { // isNaN
                        return i;
                    }
                }
                return -1;
            }
            
            // 处理-0和+0的特殊情况
            if (key === 0) {
                for (var i = 0; i < this._keys.length; i++) {
                    if (this._keys[i] === 0 && (1 / this._keys[i]) === (1 / key)) {
                        return i;
                    }
                }
                return -1;
            }
            
            return this._keys.indexOf(key);
        };
        
        global.Map = MapPolyfill;
    }

    /**
     * 🎯 Set Polyfill - 完整实现
     * 功能：ES6 Set规范完整实现
     * 兼容：iOS Safari 9+, Android 4.4+
     */
    if (needsSetPolyfill) {
        function SetPolyfill(iterable) {
            this._values = [];
            this.size = 0;
            
            // 处理可迭代对象初始化
            if (iterable != null) {
                if (typeof iterable[Symbol.iterator] === 'function') {
                    var iterator = iterable[Symbol.iterator]();
                    var step;
                    while (!(step = iterator.next()).done) {
                        this.add(step.value);
                    }
                } else if (Array.isArray(iterable)) {
                    for (var i = 0; i < iterable.length; i++) {
                        this.add(iterable[i]);
                    }
                } else {
                    throw new TypeError('Set constructor requires an iterable object');
                }
            }
        }
        
        // Set.prototype.add
        SetPolyfill.prototype.add = function(value) {
            if (!this.has(value)) {
                this._values.push(value);
                this.size++;
            }
            return this;
        };
        
        // Set.prototype.has
        SetPolyfill.prototype.has = function(value) {
            return this._indexOf(value) >= 0;
        };
        
        // Set.prototype.delete
        SetPolyfill.prototype.delete = function(value) {
            var index = this._indexOf(value);
            if (index >= 0) {
                this._values.splice(index, 1);
                this.size--;
                return true;
            }
            return false;
        };
        
        // Set.prototype.clear
        SetPolyfill.prototype.clear = function() {
            this._values.length = 0;
            this.size = 0;
        };
        
        // Set.prototype.forEach
        SetPolyfill.prototype.forEach = function(callback, thisArg) {
            if (typeof callback !== 'function') {
                throw new TypeError('Callback function required');
            }
            
            for (var i = 0; i < this._values.length; i++) {
                callback.call(thisArg, this._values[i], this._values[i], this);
            }
        };
        
        // Set.prototype.values
        SetPolyfill.prototype.values = function() {
            return new SetIterator(this._values.slice());
        };
        
        // Set.prototype.keys (alias for values)
        SetPolyfill.prototype.keys = SetPolyfill.prototype.values;
        
        // Set.prototype.entries
        SetPolyfill.prototype.entries = function() {
            var entries = [];
            for (var i = 0; i < this._values.length; i++) {
                entries.push([this._values[i], this._values[i]]);
            }
            return new SetIterator(entries);
        };
        
        // Set.prototype[Symbol.iterator]
        SetPolyfill.prototype[Symbol.iterator] = SetPolyfill.prototype.values;
        
        // 私有方法：查找索引
        SetPolyfill.prototype._indexOf = function(value) {
            // 处理NaN的特殊情况
            if (value !== value) { // isNaN
                for (var i = 0; i < this._values.length; i++) {
                    if (this._values[i] !== this._values[i]) { // isNaN
                        return i;
                    }
                }
                return -1;
            }
            
            // 处理-0和+0的特殊情况
            if (value === 0) {
                for (var i = 0; i < this._values.length; i++) {
                    if (this._values[i] === 0 && (1 / this._values[i]) === (1 / value)) {
                        return i;
                    }
                }
                return -1;
            }
            
            return this._values.indexOf(value);
        };
        
        global.Set = SetPolyfill;
    }

    /**
     * 🎯 迭代器实现
     * 功能：Map和Set的迭代器支持
     */
    function MapIterator(items, kind) {
        this._items = items;
        this._kind = kind;
        this._index = 0;
    }
    
    MapIterator.prototype.next = function() {
        if (this._index >= this._items.length) {
            return { done: true, value: undefined };
        }
        
        var value = this._items[this._index++];
        return { done: false, value: value };
    };
    
    // 添加Symbol.iterator支持
    if (typeof Symbol !== 'undefined' && Symbol.iterator) {
        MapIterator.prototype[Symbol.iterator] = function() {
            return this;
        };
    }
    
    function SetIterator(items) {
        this._items = items;
        this._index = 0;
    }
    
    SetIterator.prototype.next = function() {
        if (this._index >= this._items.length) {
            return { done: true, value: undefined };
        }
        
        var value = this._items[this._index++];
        return { done: false, value: value };
    };
    
    // 添加Symbol.iterator支持
    if (typeof Symbol !== 'undefined' && Symbol.iterator) {
        SetIterator.prototype[Symbol.iterator] = function() {
            return this;
        };
    }

    /**
     * 🎯 WeakMap Polyfill - 简化实现
     * 注意：无法完全模拟WeakMap的弱引用特性
     */
    if (typeof WeakMap === 'undefined') {
        function WeakMapPolyfill() {
            this._keys = [];
            this._values = [];
            this._id = '_weakmap_' + Math.random().toString(36).substr(2, 9);
        }
        
        WeakMapPolyfill.prototype.set = function(key, value) {
            if (key == null || (typeof key !== 'object' && typeof key !== 'function')) {
                throw new TypeError('Invalid value used as weak map key');
            }
            
            var index = this._keys.indexOf(key);
            if (index >= 0) {
                this._values[index] = value;
            } else {
                this._keys.push(key);
                this._values.push(value);
            }
            return this;
        };
        
        WeakMapPolyfill.prototype.get = function(key) {
            var index = this._keys.indexOf(key);
            return index >= 0 ? this._values[index] : undefined;
        };
        
        WeakMapPolyfill.prototype.has = function(key) {
            return this._keys.indexOf(key) >= 0;
        };
        
        WeakMapPolyfill.prototype.delete = function(key) {
            var index = this._keys.indexOf(key);
            if (index >= 0) {
                this._keys.splice(index, 1);
                this._values.splice(index, 1);
                return true;
            }
            return false;
        };
        
        global.WeakMap = WeakMapPolyfill;
    }

    /**
     * 🎯 WeakSet Polyfill - 简化实现
     * 注意：无法完全模拟WeakSet的弱引用特性
     */
    if (typeof WeakSet === 'undefined') {
        function WeakSetPolyfill() {
            this._values = [];
        }
        
        WeakSetPolyfill.prototype.add = function(value) {
            if (value == null || (typeof value !== 'object' && typeof value !== 'function')) {
                throw new TypeError('Invalid value used in weak set');
            }
            
            if (!this.has(value)) {
                this._values.push(value);
            }
            return this;
        };
        
        WeakSetPolyfill.prototype.has = function(value) {
            return this._values.indexOf(value) >= 0;
        };
        
        WeakSetPolyfill.prototype.delete = function(value) {
            var index = this._values.indexOf(value);
            if (index >= 0) {
                this._values.splice(index, 1);
                return true;
            }
            return false;
        };
        
        global.WeakSet = WeakSetPolyfill;
    }

    // Symbol.iterator polyfill (简化版)
    if (typeof Symbol === 'undefined' || !Symbol.iterator) {
        if (typeof Symbol === 'undefined') {
            global.Symbol = {};
        }
        
        var symbolCounter = 0;
        Symbol.iterator = Symbol.iterator || ('@@iterator' + (symbolCounter++));
        
        // 为Array添加Symbol.iterator支持
        if (Array.prototype[Symbol.iterator] === undefined) {
            Array.prototype[Symbol.iterator] = function() {
                var index = 0;
                var array = this;
                return {
                    next: function() {
                        if (index < array.length) {
                            return { done: false, value: array[index++] };
                        } else {
                            return { done: true, value: undefined };
                        }
                    }
                };
            };
        }
        
        // 为String添加Symbol.iterator支持
        if (String.prototype[Symbol.iterator] === undefined) {
            String.prototype[Symbol.iterator] = function() {
                var index = 0;
                var string = this;
                return {
                    next: function() {
                        if (index < string.length) {
                            return { done: false, value: string.charAt(index++) };
                        } else {
                            return { done: true, value: undefined };
                        }
                    }
                };
            };
        }
    }

    // 添加到EnglishSite命名空间
    if (typeof global.EnglishSite === 'undefined') {
        global.EnglishSite = {};
    }
    
    global.EnglishSite.Map = global.Map;
    global.EnglishSite.Set = global.Set;
    global.EnglishSite.WeakMap = global.WeakMap;
    global.EnglishSite.WeakSet = global.WeakSet;
    
})(typeof window !== 'undefined' ? window : this);
