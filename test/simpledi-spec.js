
const SimpleDi = require('../src/simpledi');

describe('SimpleDi', () => {

    /** @type {SimpleDi} */
    let di;

    beforeEach(() => {
        di = new SimpleDi();
    });

    it('registers and gets a simple object', () => {
        let obj = {foo: true};
        di.registerWithFactory('foo', () => obj);
        expect(di.get('foo')).toBe(obj);
    });

    it('throws if the name is not a string', () => {
        function Foo(){}
        const keys = [null, [], 123, Symbol('foo')];
        for (let key of keys) {
            expect(() => di.registerWithNew(key, Foo)).toThrowError('Expected dependency name to be string, but got: ' + typeof key);
        }
    });

    it('passes an additional argument to a constructor', () => {
        let barObj = {bar: true};
        di.registerWithNew('Foo', function Foo(bar) {
            this.test = () => expect(bar).toBe(barObj);
        });
        di.get('Foo', barObj).test();
    });

    it('passes an additional argument to a constructor when a dependency is defined', () => {
        let barObj = {bar: true};
        let obj = {foo: true};
        di.registerWithFactory('foo', () => obj);
        di.registerWithNew('Foo', function Foo(foo, bar) {
            this.test = () => expect(bar).toBe(barObj);
        }, ['foo']);

        di.get('Foo', barObj).test();
    });

    it('passes additional arguments to a constructor when a dependency is defined', () => {
        let barObj = {bar: true};
        let obj = {foo: true};
        di.registerWithFactory('foo', () => obj);
        di.registerWithNew('Foo', function Foo(foo, bar1, bar2) {
            this.test = () => expect(bar2).toBe(barObj);
        }, ['foo']);

        di.get('Foo', barObj, barObj).test();
    });

    it('throws when register implicitly overwrites a dependency', () => {
        let obj = {foo: true};
        di.registerConstant('foo', obj);

        expect(() => di.registerConstant('foo', obj)).toThrowError('Dependency "foo" is already registered');
    });

    it('does not throw when register explicitly overwrites a dependency', () => {
        let obj = {foo: true};
        di.registerConstant('foo', obj);

        expect(() => di.registerConstant('foo', obj, true)).not.toThrow();
    });

    it('registers and gets a constructor using the helper factory', () => {
        function Foo() {}
        di.registerWithNew('Foo', Foo);
        expect(di.get('Foo')).toBeInstanceOf(Foo);

        class Bar {}
        di.registerWithNew('Bar', Bar);
        expect(di.get('Bar')).toBeInstanceOf(Bar);
    });

    it('resolves a dependency', () => {
        function Foo(bar) {
            this.bar = bar;
        }
        class Bar {}

        di.registerWithNew('Foo', Foo, ['Bar']);
        di.registerWithNew('Bar', Bar);

        expect(di.get('Foo').bar).toBeInstanceOf(Bar);
    });

    it('throws when trying to resolve a non-existent dependency', () => {
        expect(() => di.get('foo')).toThrowError('Unknown dependency: foo');
    });

    it('throws when trying to resolve a direct circular dependency', () => {
        function Foo(/* Bar */) {}
        function Bar(/* Foo */) {}

        di.registerWithNew('Foo', Foo, ['Bar']);
        di.registerWithNew('Bar', Bar, ['Foo']);

        expect(() => di.get('Foo')).toThrowError('Circular Dependency detected: Foo => Bar => Foo');
    });

    it('throws when trying to resolve a transitive circular dependency', () => {
        function Foo(/* Bar */) {}
        function Bar(/* Foo */) {}

        di.registerWithNew('Foo', Foo, ['Bar']);
        di.registerWithNew('Bar', Bar, ['Baz']);
        di.registerWithNew('Baz', Bar, ['Foo']);

        expect(() => di.get('Foo')).toThrowError('Circular Dependency detected: Foo => Bar => Baz => Foo');
    });

    it('throws when trying to resolve a dependency that is the same module that was requested', () => {
        function Foo(/* Bar */) {}

        di.registerWithNew('Foo', Foo, ['Foo']);

        expect(() => di.get('Foo')).toThrowError('Circular Dependency detected: Foo => Foo');
    });

    it('resolves multiple dependencies', () => {
        function Foo(bar, baz) {
            this.bar = bar;
            this.baz = baz;
        }

        function Bar() {
            this.bar = true;
        }

        function Baz() {
            this.baz = true;
        }

        di.registerWithNew('Foo', Foo, ['Bar', 'Baz']);
        di.registerWithNew('Bar', Bar);
        di.registerWithNew('Baz', Baz);

        expect(di.get('Foo').baz).toBeInstanceOf(Baz);
    });

    it('provides a static identity function that returns always the same object', () => {
        let dep = {
            foo: true
        };

        di.registerConstant('foo', dep);

        expect(di.get('foo')).toBe(dep);
    });

    describe('di.registerConstants()', () => {
        it('registers multiple constants at once from a given object', () => {
            di.registerConstants({
                Foo: 111,
                Bar: 222,
                Baz: '333'
            });
            expect(di.get('Foo')).toBe(111);
            expect(di.get('Bar')).toBe(222);
            expect(di.get('Baz')).toBe('333');
        });

        it('registers multiple constants at once from a given map', () => {
            di.registerConstants(new Map([
                ['Foo', 111],
                ['Bar', 222],
                ['Baz', '333']
            ]));
            expect(di.get('Foo')).toBe(111);
            expect(di.get('Bar')).toBe(222);
            expect(di.get('Baz')).toBe('333');
        });

        it('throws if the optional prefix is truthy but no string', () => {
            const ERROR = 'Prefix must be nullish or string';
            expect(() => di.registerConstants({foo: 123}, 'str')).not.toThrow();
            expect(() => di.registerConstants({bar: 123}, 111)).toThrowError(ERROR);
            expect(() => di.registerConstants({bar: 123}, {})).toThrowError(ERROR);
            expect(() => di.registerConstants({bar: 123}, function(){})).toThrowError(ERROR);
        });
    });

    it('counts how often dependencies where resolved', () => {
        let obj = {foo: true};
        di.registerWithFactory('foo', () => obj);

        di.get('foo');
        const counterMap = di.getResolvedDependencyCount();
        expect(counterMap).toBeInstanceOf(Map);
        expect(counterMap.get('foo')).toBe(1);
    });

    it('counts how often dependencies where resolved with deep dependencies', () => {
        let obj = {foo: true};
        di.registerWithFactory('foo', () => obj);
        di.registerWithFactory('bar', () => obj, ['foo']);

        di.get('bar');
        di.get('foo');
        di.get('foo');

        expect(di._registry.size).toBe(2);

        const m = di.getResolvedDependencyCount();
        expect(m.size).toBe(2);
        expect(m.get('foo')).toBe(3);
        expect(m.get('bar')).toBe(1);
    });

    it('resolves dependencies with transitive dependencies', () => {
        /** @constructor */
        function Foo(bar, baz, more) {
            this.bar = bar;
            this.baz = baz;
            this.more = more;
        }
        class Bar {}
        class Baz {}

        di.registerWithNew('Foo', Foo, ['Bar', 'Baz']);
        di.registerWithNew('Bar', Bar, []);
        di.registerWithNew('Baz', Baz, ['Bar']);
        let foo;
        expect(() => foo = di.get('Foo', 'huhu')).not.toThrow();
        expect(foo).toBeInstanceOf(Foo);
        expect(foo.bar).toBeInstanceOf(Bar);
        expect(foo.baz).toBeInstanceOf(Baz);
        expect(foo.more).toBe('huhu');
    });

    it('throws when registering with an invalid factory function', () => {
        let fns = ['huhu', null, [], 123];
        for (let fn of fns) {
            expect(() => di.registerWithFactory('Foo', fn)).toThrowError('Expected a factory function, but got: ' + typeof fn);
            expect(() => di.registerWithFactoryOnce('Foo', fn)).toThrowError('Expected a factory function, but got: ' + typeof fn);
        }
    });

    it('throws when registering with an invalid class/constructor', () => {
        let fns = ['huhu', null, [], 123];
        for (let fn of fns) {
            expect(() => di.registerWithNew('Foo', fn)).toThrowError('Expected a constructor function, but got: ' + typeof fn);
            expect(() => di.registerWithNewOnce('Foo', fn)).toThrowError('Expected a constructor function, but got: ' + typeof fn);
        }
    });

    it('throws when registering with an invalid dependencies array', () => {
        class Foo {}
        expect(() => di.registerWithNew('Foo', Foo, 'bad array')).toThrowError('Expected dependencies for "Foo" to be array of string, but got: string');
        expect(() => di.registerWithNew('Foo', Foo, [666, 777])).toThrowError('Expected dependencies for "Foo" to be array of string, but got: [number, number]');
        expect(() => di.registerWithNew('Foo', Foo, ['subdep', 666])).toThrowError('Expected dependencies for "Foo" to be array of string, but got: [string, number]');
        expect(() => di.registerWithNew('Foo', Foo, 666)).toThrowError('Expected dependencies for "Foo" to be array of string, but got: number');
        expect(() => di.registerWithNew('Foo', Foo, () => null)).toThrowError('Expected dependencies for "Foo" to be array of string, but got: function');

        expect(() => di.registerWithNew('Foo', Foo, ['dep1', 'dep2'])).not.toThrow();
        expect(() => di.registerWithNew('Foo2', Foo, [])).not.toThrow();
    });

    describe('registerWithNewOnce()', () => {
        it('makes get() instantiate a constructor with new once, thereafter returning that same instance', () => {
            function Foo() {
                this.foo = true;
            }

            di.registerWithNewOnce('Foo', Foo);

            let foo1 = di.get('Foo');
            let foo2 = di.get('Foo');

            expect(foo1).toBe(foo2);
        });

        it('make get() always return the same instance', () => {
            function Foo(bar) {
                this.foo = true;
                this.bar = bar;
            }

            let bar = {
                bar: true
            };

            di.registerWithNewOnce('Foo', Foo, ['bar']);
            di.registerConstant('bar', bar);

            let foo = di.get('Foo');

            expect(foo.bar).toBe(bar);
        });
    });

    describe('registerWithFactoryOnce()', () => {
        it('makes get() invoke the factory only once, thereafter returning the factory\'s return value', () => {
            const create = jasmine.createSpy(() => ({}));

            di.registerWithFactoryOnce('create', create);

            let foo1 = di.get('create');
            let foo2 = di.get('create');

            expect(foo1).toBe(foo2);
            expect(create).toHaveBeenCalledTimes(1);
        });

        it('is independent of falsy return values from the factory', () => {
            const createBar = jasmine.createSpy().and.returnValue(null);

            di.registerWithFactoryOnce('Bar', createBar, []);

            expect(di.get('Bar')).toBe(null);
            expect(di.get('Bar')).toBe(null);
            expect(createBar).toHaveBeenCalledTimes(1);
        });

        it('returns always the same instance and resolves dependencies', () => {
            let create = (x) => ({x});
            let bar = {
                bar: true
            };

            di.registerWithFactoryOnce('create', create, ['bar']);
            di.registerConstant('bar', bar);

            let foo = di.get('create');

            expect(foo.x).toBe(bar);
        });
    });

    describe('di.get()', () => {
        const ERROR_MSG = 'di.get("foo", ...args) with non-empty args is only allowed as the first di.get() call for this ONCE-dependency. You can use di.setIgnoreArgsPassedToFinalValue(true) to suppress this error.';
        it ('throws an error if called WITH ARGUMENTS for the 2nd+ time for a registerWithClassOnce dependency', () => {
            function Foo(b) {
                this.bar = b;
            }
            di.registerWithNewOnce('foo', Foo);

            let foo = di.get('foo', 123);
            expect(foo.bar).toBe(123);
            expect(() => di.get('foo', 666)).toThrowError(ERROR_MSG);
            expect(() => di.get('foo')).not.toThrow();

            // test suppressing the error
            expect(() => di.get('foo', 666)).toThrowError(ERROR_MSG);
            di.setIgnoreArgsPassedToFinalValue(true);
            expect(() => di.get('foo', 666)).not.toThrow();
            di.setIgnoreArgsPassedToFinalValue(false);
            expect(() => di.get('foo', 666)).toThrowError(ERROR_MSG);
        });

        it ('throws an error if called WITH ARGUMENTS for the 2nd+ time for a registerWithFactoryOnce dependency', () => {
            const foo = b => b * b;
            di.registerWithFactoryOnce('foo', foo);

            let sixteen = di.get('foo', 4);
            expect(sixteen).toBe(16);
            expect(() => di.get('foo', 5)).toThrowError(ERROR_MSG);
            expect(() => di.get('foo')).not.toThrow();
            expect(di.get('foo')).toBe(16);

            // test suppressing the error
            expect(() => di.get('foo', 666)).toThrowError(ERROR_MSG);
            di.setIgnoreArgsPassedToFinalValue(true);
            expect(() => di.get('foo', 666)).not.toThrow();
            di.setIgnoreArgsPassedToFinalValue(false);
            expect(() => di.get('foo', 666)).toThrowError(ERROR_MSG);
        });
    });

});
