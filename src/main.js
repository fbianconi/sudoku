const Text = {
    es: {
        "Continue":"Continuar",
        "Restart":"Reiniciar",
        "New Game":"Juego Nuevo",
        "Options":"Opciones",
        "Easy":"Fácil",
        "Medium":"Medio",
        "Hard":"Difícil",
        "Extreme":"Extremo",
        "Back":"Volver",
        "Cancel":"Cancelar",
        "Music":"Música",
        "Allow Help":"Permitir Ayuda",
        "Well Done!":"Bien Hecho!",
        "Time:":"Tiempo:",
        "Your Time:":"Tu Tiempo:",
        'How to play':"Cómo se Juega",
        'The objective of the game is to fill the whole board with numbers.':
            "El objetivo del juego es rellenar el tablero de números.",
        'Numbers can not repeat along the same row, column, or group.':
            "Los números no pueden repetirse en la misma fila, columna o grupo.",
        'To enter a number to the board, you must first select it using one of the buttons next to the board, and then tap on an empty tile.':
            "Para ingresar un número al tablero, debes seleccionarlo primero usando los botones cercanos al tablero, y luego toca un casillero vacío.",
        'To delete an entered number tap on it again, you can only delete the same number that is selected. You can\'t delete the numbers on the initial board.':
            "Para eliminar un número ingresado tócalo de nuevo, sólo puedes eliminar el mismo número que está seleccionado. No puedes eliminar los números inicales del tablero",
        'You can also make notes about where you suspect a number might end up, tap the pen icon to enter numbers in note mode, and proceed as with the numbers.':
            "También puedes anotar donde sospechas que puede ir un número, toca el ícono que tiene un lápiz, y procede de la misma manera que con los números.",
        'If you need to, you can reset the board, just tap the menu button and hit reset. The board will be cleared of numbers and notes, but the timer won\'t':
            "Si lo necesitas, puedes reiniciar el tablero, toca el botón de menú y aprieta reiniciar. El tablero se limpiará, pero el reloj seguirá corriendo.",
    },
}

const ls = window.localStorage
const [lang, variant] = ((navigator.languages && navigator.languages.length) ? navigator.languages[0] :
    navigator.userLanguage || navigator.language || navigator.browserLanguage || 'es-AR').split("-");


// https://css-tricks.com/the-trick-to-viewport-units-on-mobile/
let vh = window.innerHeight * 0.01;
document.documentElement.style.setProperty('--vh', `${vh}px`);
window.addEventListener('resize', () => {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
});

let data = {
    nightMode: false,
    playAudio: true,
    showmenu: true,
    locale: lang,
    menu: 'newgame',
    canResume: false,
    canReset: false,
    databoard: Array(81).fill(0),
    begin: [],
    undoList: [],
    notes: Array(81).fill(() => new Set()),
    undoIndex: 0,
    selected: null,
    annotate: false,
    focused: null,
    seed: 637485, //start with fixed value
    startTime: null,
    ellapsedTime: null,
    finishedTime: null,
    paused: false,
    helpAllowed: true,
    digitFirst: true,
    hint: -1,
    warningCol: -1,
    warningRow: -1,
    warningGrp: -1,
    displayTime: "00:00",
    gameCompleted: false,
    timerInterval: null
}

//autosave state
let watch = {}
for (let prop of Object.keys(data)) {
    watch[prop] = function (after, before) {
        if (prop == "databoard" || prop == "notes") {
            let arrset = after.map((x) => (this.isValid(x) ? x : Array.from(x)))
            ls[prop] = JSON.stringify(arrset)
        } else {
            ls[prop] = JSON.stringify(after)
        }
    };
}

var app = new Vue({
    el: "#sudoku-game",
    data: data,
    created() {
        //autoload state
        for (let prop of Object.keys(this._data)) {
            if (ls[prop] != undefined) {
                this._data[prop] = JSON.parse(ls[prop])
                if (prop == "databoard" || prop == "notes") {
                    let arrset = this._data[prop].map((x) => (this.isValid(x) ? x : new Set(x)))
                    this._data[prop] = arrset
                }
            }
        }

        // Iniciar el temporizador si hay un juego en curso
        if (this.startTime && !this.finishedTime) {
            this.startTimer();
        }
    },
    methods: {
        ns(i) {
            let val = !this.isValid(this.databoard[i])
            let has = this.notes[i].has ? this.notes[i].has(this.selected) : false
            return val && has
        },

        t(string) {
            if (Text[this.locale][string]) return Text[this.locale][string]
            console.log("missing (" + this.locale + "): '" + string + "'")
            return string
        },

        group(n) { return (~~(n / 3) % 3 + 3 * (~~(n / 27))) + 1 },

        column(n) { return n % 9 + 1 },

        row(n) { return ~~(n / 9) + 1 },

        resume() {
            if (this.canResume) {
                this.showmenu = false;
                if (this.startTime && !this.finishedTime) {
                    this.startTimer();
                }
            }
        },

        reset() {
            if (this.canReset) {
                this.newGame("reset");
            }
        },

        // Función para formatear el tiempo en minutos:segundos
        formatTime(milliseconds) {
            if (!milliseconds) return "00:00";
            const totalSeconds = Math.floor(milliseconds / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        },

        // Iniciar el temporizador
        startTimer() {
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
            }

            this.timerInterval = setInterval(() => {
                if (!this.paused && this.startTime && !this.finishedTime) {
                    const now = new Date();
                    this.ellapsedTime = now - this.startTime;
                    this.displayTime = this.formatTime(this.ellapsedTime);
                }
            }, 1000);
        },

        // Detener el temporizador
        stopTimer() {
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }
        },

        newGame(n) {
            if (n === "reset") {
                this.notes = Array.from({ length: 81 }, () => new Set())
                this.databoard = Array.from({ length: 81 }, () => new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]))
                for (let i = 0; i < 81; i++) {
                    if (this.isValid(this.begin[i])) this.put(this.databoard, i, this.begin[i])
                }
            } else {
                this.notes = Array.from({ length: 81 }, () => new Set())
                this.begin = []
                this.databoard = this.newBoard(n)
                this.begin = this.databoard.map((x) => (this.isValid(x) ? x : ""))
                this.startTime = new Date() //TODO: implement pauses?
                this.pausedTime = null
                this.displayTime = "00:00";
                this.startTimer();
            }
            this.canResume = true;
            this.canReset = false
            this.selected = null;
            this.finishedTime = null
            this.finished = null
            this.showmenu = false
            this.menu = 'main'
            this.undoList = []
            this.undoIndex = 0
            this.annotate = false
            this.focused = null
            this.hint = -1
            this.gameCompleted = false;
        },

        newBoard(n) {
            //start with a filled (solved) board 
            let board = this.solve(Array.from({ length: 81 }, () => new Set([1, 2, 3, 4, 5, 6, 7, 8, 9])))
            let solution = board.map((x) => (this.isValid(x) ? x : new Set(x)))
            let order = new Set(Array.from({ length: 81 }, (v, i) => i))
            let chaos = []
            while (order.size) chaos.push(this.pickOne(order))

            let removed = 0
            for (let i of chaos) {
                let value = board[i]
                this.remove(board, i)
                removed++
                if (!this.isUnique(board, solution)) {
                    //undo
                    this.put(board, i, value)
                    removed--
                }
                if (removed > n) return board
            }
            return board
        },

        endGame() {
            this.canResume = false;
            this.finishedTime = this.ellapsedTime;
            this.gameCompleted = true;
            this.stopTimer();
            this.selected = null;
            //TODO: congratulation and scoreboards
            this.menu = "newgame"
            setTimeout(() => { this.showmenu = true; this.gameCompleted = false; }, 5000)
        },

        random() {
            this.seed = Math.abs(this.seed * 16807 % 2147483647);
            return (this.seed - 1) / 2147483646
        },

        isFull(n) { return 9 == this.databoard.reduce((count, x) => count + (x == n), 0); },

        play(e) {
            //TODO: sort this mess out
            let el = e.target.closest("[data-index]")
            let i = el.dataset.index
            if (!this.isValid(this.begin[i])) { //didn't hit a default value
                let sel = this.selected
                let val = this.databoard[i]
                if (this.annotate) {
                    this.notes[i].has(sel) ? this.notes[i].delete(sel) : this.notes[i].add(sel)
                    this.$set(this.notes, i, this.notes[i])
                    this.addToUndo({ type: "note", index: i, sel: sel })
                    return
                }
                if (val == sel) { //already there, remove it
                    this.remove(this.databoard, i)
                    this.$set(this.databoard, i, this.databoard[i])
                    this.addToUndo({ type: "number", index: i, sel: sel })
                } else if (!this.isValid(val)) { // cell is empty
                    let notes = this.notes.map((x) => new Set(x))
                    if (this.put(this.databoard, i, sel, this.helpAllowed, true)) {
                        this.$set(this.databoard, i, this.databoard[i])
                        let notediff = []
                        for (let i = 0; i < 81; i++) {
                            if (notes[i].has(sel) != this.notes[i].has(sel)) notediff.push(i)
                        }
                        this.addToUndo({ type: "number", index: i, sel: sel, notes: notediff })
                        this.canReset = true
                    }
                }
                // else if (val != '' ){//there's other value there, switch it??                    
                // }
            }
            if (this.isSolved(this.databoard)) {
                this.endGame()
            }
        },

        addToUndo(undo) {
            if (this.undoIndex != this.undoList.length) {
                //discard redo operations
                this.undoList.splice(this.undoIndex, this.undoList.length)
            }
            this.undoList.push(undo)
            this.undoIndex = this.undoList.length
        },

        _do(direction) {
            if (direction > 0 && this.undoIndex < this.undoList.length) {
                var undo = this.undoList[this.undoIndex]
                this.undoIndex++
            } else if (direction < 0 && this.undoIndex > 0) {
                this.undoIndex--
                undo = this.undoList[this.undoIndex]
            } else {
                return
            }
            console.log(undo)
            if (undo.type == "number") {
                if (this.databoard[undo.index] == undo.sel) { //has the exact number
                    this.remove(this.databoard, undo.index)
                    this.$set(this.databoard, undo.index, this.databoard[undo.index])
                } else if (!this.isValid(this.databoard[undo.index])) { //is empty
                    this.put(this.databoard, undo.index, undo.sel, this.helpAllowed)
                    this.$set(this.databoard, undo.index, this.databoard[undo.index])
                }
                if (undo.notes) {
                    for (let j of undo.notes) {
                        if (this.notes[j].has(undo.sel)) { this.notes[j].delete(undo.sel) }
                        else { (this.notes[j].add(undo.sel)) }
                    }
                }
            } else if (undo.type == "note") {
                if (this.notes[undo.index].has(undo.sel)) this.notes[undo.index].delete(undo.sel)
                else (this.notes[undo.index].add(undo.sel))
            }
        },
        undo() { this._do(-1) },
        redo() { this._do(+1) },

        put(board, index, value, helpAllowed, interactive) {
            //put a value to the board if the state admits it, or if help is disabled
            //tile should contain an array of possible values; or a number if it's been filled
            let possible = true
            if (helpAllowed && (!board[index] || !board[index].has || !board[index].has(value))) possible = false;
            let col = index % 9
            let row = ~~(index / 9)
            let gc = ~~(col / 3)
            let gr = ~~(row / 3)
            for (let i = 0; i < 9; i++) {
                let c = i * 9 + col
                let r = row * 9 + i
                let gx = i % 3
                let gy = ~~(i / 3)
                let g = 3 * gc + gx + 27 * gr + 9 * gy
                if (possible) {
                    if (Set.prototype.isPrototypeOf(board[c])) board[c].delete(value)
                    if (Set.prototype.isPrototypeOf(board[r])) board[r].delete(value)
                    if (Set.prototype.isPrototypeOf(board[g])) board[g].delete(value)
                    if (interactive) {
                        this.notes[c].delete(value)
                        this.$set(this.notes, c, this.notes[c])
                        this.notes[r].delete(value)
                        this.$set(this.notes, r, this.notes[r])
                        this.notes[g].delete(value)
                        this.$set(this.notes, g, this.notes[g])
                    }
                } else {
                    if (interactive) {
                        if (this.databoard[c] == this.selected) this.warningCol = this.column(index)
                        if (this.databoard[g] == this.selected) this.warningGrp = this.group(index)
                        if (this.databoard[r] == this.selected) this.warningRow = this.row(index)
                    }
                }
            }
            if (this.warningCol != -1 || this.warningGrp != -1 || this.warningRow != -1) {
                setTimeout(() => { this.warningCol = -1; this.warningGrp = -1; this.warningRow = -1 }, 1000)
            }
            if (possible) board[index] = value;
            return possible;
        },

        remove(board, index) {
            //maybe there's a better way for this.
            let myBoard = Array.from({ length: 81 }, e => new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]))
            for (let x = 0; x < board.length; x++) {
                if (this.isValid(board[x]) && x != index) this.put(myBoard, x, board[x])
            }
            //replace array in situ
            Array.prototype.splice.apply(board, [0, myBoard.length].concat(myBoard));
        },

        pickOne(aset) {
            //Selects random item from set, delete it from the set and return it; like a random Array.pop()
            let idx = ~~(this.random() * aset.size)
            let value = [...aset][idx]
            aset.delete(value)
            return value
        },

        isSolvable(board) {
            //true if all the empty tiles have at least one possible value;
            //Is a misnomer, as it doesn't guarantees that can actually be solved.
            for (let i = 0; i < board.length; i++) {
                if (board[i] === undefined || (Set.prototype.isPrototypeOf(board[i]) && board[i].size == 0)) return false
            }
            return true
        },

        isSolved(board) {
            for (let i = 0; i < board.length; i++) {
                if (!this.isValid(board[i])) return false
            }
            return true
        },

        isValid(n) {
            if (typeof n === "object") return false;
            return /^[1-9]$/.test('' + n)
        },

        solve(someBoard) { return this.isUnique(someBoard) },

        isUnique(someBoard, solution) {
            //backtrack solver (check every solution version)
            let board = someBoard.map((x) => (this.isValid(x) ? x : new Set(x))), //2 level array clone 
                stack = [] //private undo stack
            do {
                while (this.isSolvable(board) && !this.isSolved(board)) {
                    let min = 10
                    let index = -1
                    for (let i = 0; i < 81; i++) {
                        //select next index                        
                        if (!this.isValid(board[i])) {
                            if (board[i] != undefined && board[i].size < min) {
                                min = board[i].size
                                index = i
                            }
                        }
                    }
                    if (min == 1) {
                        //if there's only one value possible just put it in
                        this.put(board, index, [...board[index]][0])
                    } else {
                        //if there's more than one possible values, stack the state and use the next
                        let values = new Set(board[index])
                        let myValue = this.pickOne(values)
                        let oldBoard = board.map((x) => (this.isValid(x) ? x : new Set(x)))
                        stack.push({ index: index, values: values, board: oldBoard })
                        this.put(board, index, myValue)
                    }
                }
                if (this.isSolved(board)) {
                    if (solution) {
                        for (let i = 0; i < 81; i++) {
                            if (board[i] != solution[i]) return false
                        }
                    } else { //if invoqued without solution we're meant to solve it
                        return board
                    }
                }
                //back to last choice
                do {
                    var undo = stack.pop() //let it hoist
                } while (undo && undo.values.size == 0) //unstack all the finished alternatives
                if (undo === undefined) { //options exhausted
                    return this.isSolved(board) // we've checked everything and didn't bailed yet
                }
                board = undo.board
                let myValue = this.pickOne(undo.values)
                this.put(board, undo.index, myValue)
                stack.push(undo)
            } while (stack.length != 0)
            return true
        },

        showHint(board) {
            let solvable = true;
            let index = undefined
            for (let i = 0; i < 81; i++) {
                if (!this.isValid(board[i]) && board[i].size === 0) solvable = false //solvable?
                if (!this.isValid(board[i]) && board[i].size === 1) index = i;
            }
            if (!solvable) {
                console.log("Not solvable")
            }
            if (index >= 0) {
                this.hint = index
                setTimeout(() => this.hint = -1, 4000)
            }
        }

    },
    watch: watch,
    beforeDestroy() {
        // Limpiar el intervalo al destruir el componente
        this.stopTimer();
    }
})

// Control de pausa cuando el juego pierde el foco
window.addEventListener('blur', function () {
    if (app.startTime && !app.finishedTime && !app.showmenu) {
        app.paused = true;
    }
});

window.addEventListener('focus', function () {
    if (app.startTime && !app.finishedTime && app.paused) {
        app.paused = false;
    }
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
        navigator.serviceWorker.register('worker.js').then(function (registration) {
            // Registration was successful
            console.log('ServiceWorker registration successful with scope: ', registration.scope);
        }, function (err) {
            // registration failed :(
            console.log('ServiceWorker registration failed: ', err);
        });
    });
}

