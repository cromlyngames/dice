var _ = require("lodash");
var Lexer = require("lex");
var Parser = require("./parse");
var koa = require('koa');
var koaBody = require('koa-body');
var koaRouter = require('koa-router');

var lexer = new Lexer;

// whitespace
lexer.addRule(/\s+/);

// n-side roller
lexer.addRule(/d/, lexeme => lexeme);

// fudge roller
lexer.addRule(/df/, lexeme => lexeme);

// digits
lexer.addRule(/[0-9]+/, lexeme => lexeme);

// arithmetic
lexer.addRule(/[\(\+\-\*\/\)]/, lexeme => lexeme);

var first = {
    precedence: 3,
    associativity: "left"
};

var second = {
    precedence: 2,
    associativity: "left"
};

var third = {
    precedence: 1,
    associativity: "left"
};

var parser = new Parser({
    "d": first,
    "df": first,
    "*": second,
    "/": second,
    "+": third,
    "-": third
});

function parse(input) {
    lexer.setInput(input);
    var tokens = [], token;
    while (token = lexer.lex()) tokens.push(token);
    return parser.parse(tokens);
}

var Dice = function(command) {
    var self = this;
    self.rolls = [];
    self.stack = [];
    self.command = command;

    self.operator = {
        "d": function (a, b) {
            return _.range(a)
                .map(() => self.roll(1, b))
                .reduce((x, y) => x + y);
        },
        "df": function (a) {
            return _.range(a)
                .map(() => self.roll(-1, 1))
                .reduce((x, y) => x + y);
        },
        "+": function (a, b) {
            return a + b;
        },
        "-": function (a, b) {
            return a - b;
        },
        "*": function (a, b) {
            return a * b;
        },
        "/": function (a, b) {
            return a / b;
        }
    }
};

Dice.prototype.roll = function (min, max) {
    var die = Math.floor(Math.random() * (max - min + 1)) + min;
    this.rolls.push(die);
    return die;
};

Dice.prototype.execute = function() {
    var self = this;

    parse(self.command).forEach(function (c) {
        switch (c) {
            case "+":
            case "-":
            case "*":
            case "/":
            case "d":
                var b = +self.stack.pop();
                var a = +self.stack.pop();
                self.stack.push(self.operator[c](a, b));
                break;
            case "df":
                var a = +self.stack.pop();
                self.stack.push(self.operator[c](a));
                break;
            default:
                self.stack.push(parseInt(c));
                break;
        }
    });
};

var app = koa();
app.use(koaBody());

var router = koaRouter();
var allowed = JSON.parse(process.env.ALLOWED || '[]');


router.post('/', function *() {
    var user = this.request.body.user_name;
    var response = 'Only patrons are allowed to test beta releases. ' +
        'Support development at  https://www.patreon.com/rpg_talk';

    if (allowed.contains(user)) {
        var dice = new Dice(this.request.body.text);
        dice.execute();

        var result = dice.stack.pop();
        var rolls = dice.rolls;
        response = rolls + ' = ' + result;
    }

    this.body = {
        response_type: 'in_channel',
        text: response
    }
});

app.use(router.routes())
app.use(router.allowedMethods());

app.listen((process.env.PORT || 5000));