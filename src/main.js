//todo: split logic and presentation is it worth it??

const text = {
    en:{},
    es:{
        "Continue": "Continuar",
        "Restart":  "Reiniciar",
        "New Game": "Juego Nuevo",
        "Options":  "Opciones",
        "Easy":     "Fácil",
        "Medium":   "Medio",
        "Hard":     "Difícil",
        "Extreme":  "Extremo",
        "Back":     "Volver",
        "Cancel":   "Cancelar",
        "Music":    "Música",
        "Allow Help":"Permitir Ayuda",
        "Well Done!":"Bien Hecho!",
    },
}

const ls = window.localStorage
const lang = (navigator.languages && navigator.languages.length)? navigator.languages[0]:
     navigator.userLanguage || navigator.language || navigator.browserLanguage || 'en';

let data= {
    playAudio:true,
    showmenu: true,
    locale: lang,
    menu: 'newgame',
    canResume: false,
    canReset: false,
    databoard: Array(81).fill(0),
    begin:[],
    undoList:[],
    notes: Array(81).fill( () => new Set() ),
    undoIndex:0,
    selected:null,
    annotate:false,
    focused:null,
    seed:637485, //start with fixed value
    startTime:null,
    pausedTime:null,
    finishedTime:null,
    helpAllowed:true,
    digitFirst:true,
    hint:-1
}

//autosave state
let watch={}
for (let prop of Object.keys(data)){
    watch[prop] = function(after, before){
        if (prop == "databoard" || prop == "notes"){
            let arrset = after.map( (x)=> (this.isValid(x) ? x : Array.from(x) ) )
            ls[prop] = JSON.stringify(arrset)            
        }else{
            ls[prop] = JSON.stringify(after)
        }
    };
}


var app=new Vue({
    el:"#sudoku-game",
    data:data,
    created(){
        //autoload state
        for (let prop of Object.keys(this._data)){
            if (ls[prop] != undefined){
                this._data[prop] = JSON.parse(ls[prop])
                if (prop == "databoard" || prop == "notes"){
                    let arrset = this._data[prop].map( (x)=> (this.isValid(x) ? x : new Set(x) ) )
                    this._data[prop] = arrset
                }
            }
        }
    },
    methods: {
        ns(i){
            let val= !this.isValid(this.databoard[i])
            let has= this.notes[i].has? this.notes[i].has(this.selected):false
            return val && has
        },
        t(string){
            if (text[this.locale][string]) return text[this.locale][string]
            console.log ("missing ("+this.locale+"): '"+string+"'")
            return string
        },
        group(n){return ( ~~(n/3)%3 + 3*(~~(n/27)))+1 } ,
        column(n){return n % 9+1} ,
        row(n){return ~~(n / 9)+1} ,
        resume(){if (this.canResume) this.showmenu=false } ,
        reset(){if (this.canReset) this.newGame("reset")},
        newGame(n){
            if (n === "reset"){
                this.notes=Array.from({length: 81}, () => new Set())
                this.databoard= Array.from({length: 81}, () => new Set([1,2,3,4,5,6,7,8,9]))
                for (let i =0;i<81;i++){
                    if (this.isValid(this.begin[i]))this.put(this.databoard, i, this.begin[i])
                }
            }else{
                this.notes=Array.from({length: 81}, () => new Set())
                this.begin=[]
                this.databoard=this.newBoard(n)
                this.begin=this.databoard.map( (x)=> (this.isValid(x) ? x : "" ) )
                this.startTime=new Date() //TODO: implement pauses?
                this.pausedTime=null
            }
            this.canResume=true;
            this.canReset= false
            this.selected=null;
            this.finishedTime=null
            this.finished=null
            this.showmenu=false
            this.menu='main'
            this.undoList=[]
            this.undoIndex=0
            this.annotate=false
            this.focused=null
            this.hint=-1
        },
        newBoard(n){
            //start with a filled (solved) board 
            let board = this.solve( Array.from({length: 81}, () => new Set([1,2,3,4,5,6,7,8,9] )) )
            let solution = board.map( (x)=> (this.isValid(x) ? x : new Set(x) ) )
            let order = new Set(Array.from({length: 81}, (v, i) => i))
            let chaos = [] 
            while (order.size) chaos.push( this.pickOne(order) )

            let removed = 0
            for (let i of chaos){
                let value = board[i]
                this.remove(board, i)
                removed++
                if (!this.isUnique(board, solution)){
                    //undo
                    this.put(board,i,value)
                    removed--
                }
                if (removed>n) return board
            }
            return board
        },
        endGame(){
            this.canResume=false;
            this.finished=new Date();
            this.selected=null;
            //TODO: congratulation and scoreboards
            this.menu="newgame"
            setTimeout( ()=>this.showmenu=true , 2000 )
        },
        random(){
            this.seed = Math.abs(this.seed * 16807 % 2147483647);
            return (this.seed - 1) / 2147483646
        },
        isFull(n){return 9==this.databoard.reduce( (count,x)=>count+(x==n), 0); },
        play(e){
            let el = e.target.closest("[data-index]")
            let i = el.dataset.index
            if ( !this.isValid(this.begin[i]) ){ //didn't hit a default value
                let sel = this.selected
                let val = this.databoard[i]
                if(this.annotate){
                    this.notes[i].has(sel) ? this.notes[i].delete(sel) : this.notes[i].add(sel)
                    this.$set(this.notes, i, this.notes[i])
                    return
                }
                if ( val == sel){ //already there, remove it
                    this.remove(this.databoard, i)
                    this.$set(this.databoard, i, this.databoard[i])
                    this.addToUndo(i, sel)
                }else if (! this.isValid(val) ){ // cell is empty
                    if (this.put(this.databoard, i, sel, this.helpAllowed, true)){
                        this.$set(this.databoard, i, this.databoard[i])
                        this.addToUndo(i, sel)
                        this.canReset=true
                    }
                }
                // else if (val != '' ){//there's other value there, switch it??                    
                // }
            }
            if( this.isSolved(this.databoard) ){
                this.endGame()
            }
        },
        addToUndo(index, value){
            if (this.undoIndex != this.undoList.length){
                //discard redo operations
                this.undoList.splice(this.undoIndex, this.undoList.length)
            }
            //todo: 
            this.undoList.push({index:index, value:value})   
            this.undoIndex = this.undoList.length                            
        },
        _do(direction){
            if (direction > 0 &&  this.undoIndex < this.undoList.length){
                this.undoIndex++
                var undo = this.undoList[this.undoIndex]
            }
            if (direction < 0 &&  this.undoIndex > 0){
                this.undoIndex--
                undo = this.undoList[this.undoIndex]
            }
            if(undo){
                if (this.databoard[undo.index]==undo.value){
                    this.$set(this.databoard, undo.index, "")
                    this.remove(this.databoard, undo.index)
                }else if (!this.isValid(this.databoard[undo.index])){
                    this.$set(this.databoard, undo.index, undo.value)
                    this.put(this.databoard, undo.index, undo.value, this.helpAllowed)                    
                }
            }
        },
        undo(){this._do(-1)},
        redo(){this._do(+1)},
        
        put(board, index, value, helpAllowed, interactive){
            //put a value to the board if the state admits it, or if help is disabled
            //tile should contain an array of possible values; or a number if it's been filled
            if (helpAllowed && (!board[index] || !board[index].has || !board[index].has(value))) return false;
            let col = index % 9
            let row = ~~(index / 9)
            let gc = ~~(col / 3)
            let gr = ~~(row / 3)
            for (let i = 0 ; i < 9 ; i++) {
                let c = i * 9 + col
                let r = row * 9 + i
                let gx = i % 3
                let gy = ~~(i / 3)
                let g = 3 * gc + gx + 27 * gr + 9 * gy  
                if (Set.prototype.isPrototypeOf( board[c] ) ) board[c].delete(value)
                if (Set.prototype.isPrototypeOf( board[r] ) ) board[r].delete(value) 
                if (Set.prototype.isPrototypeOf( board[g] ) ) board[g].delete(value)
                if (interactive){
                    this.notes[c].delete(value)
                    this.$set(this.notes, c,this.notes[c])
                    this.notes[r].delete(value)
                    this.$set(this.notes, r,this.notes[r])
                    this.notes[g].delete(value)
                    this.$set(this.notes, g,this.notes[g])
                }
            }            
            board[index]=value;
            return true;
        },
        remove(board, index){
            //TODO: maybe there's a better way for this.
	        let myBoard = Array.from({length: 81}, e => new Set([1,2,3,4,5,6,7,8,9]) )
	        for(let x = 0; x < board.length; x++) {
		        if( this.isValid(board[x]) && x != index ) this.put( myBoard, x, board[x] )
	        }
            Array.prototype.splice.apply(board, [0, myBoard.length].concat(myBoard));
        },
        pickOne(aset) {
            //Selects random item from set, delete it from the set and return it; like a random Array.pop()
	        let idx = ~~(this.random() * aset.size)
	        let value = [...aset][idx]
	        aset.delete(value)
	        return value
        },
        isSolvable(board){
            //true if all the empty tiles have at least one possible value;
            //Is a misnomer, as it doesn't guarantees that can actually be solved.
	        for (let i = 0; i < board.length; i++){
                if (board[i] === undefined || (Set.prototype.isPrototypeOf(board[i]) && board[i].size == 0)) return false
	        }
	        return true
        },
        isSolved(board){
	        for (let i=0; i<board.length; i++){
		        if ( !this.isValid( board[i] )) return false
	        }
	        return true
        },
        isValid(n){
            if (typeof n === "object" ) return false;
            return /^[1-9]$/.test(''+n)
        },
        solve(someBoard){
            //receive the board as parameter, we don't want to show how we put it together,
            //backtrack depth-first solver (return first solution)
            let board = Array.from(someBoard, (x)=> (this.isValid(x) ? x : new Set(x) ) ), //2 level array clone 
                stack = [] //private undo stack
	        while (!this.isSolved(board)){
		        while(this.isSolvable(board)) {
                    let min=10
                    let index =-1
                    for (let i=0;i<81;i++){
                        if(board[i] && !this.isValid( board[i] )) {
                            if (board[i].size != undefined && board[i].size < min ){
                                min = board[i].size
                                index = i
                            }
                        }
                        if(board[i]==undefined){ //some bug catching
                            console.log(i, board, stack)
                            return null
                        }
                    }
                    if (min == 10){
                        // isSolvable( solved_board ) == true    wouldn't leave inner loop
                        return board
                    }
                    if (min == 1){
                        this.put (board, index, [...board[index]][0])
			        }else{
                        //if there's more than one possible values, pick one at random and stack the state
				        let values = new Set( board[index] )
				        let myValue = this.pickOne( values )
                        let oldBoard = Array.from(board, (x)=> (this.isValid(x) ? x : new Set(x) ) )
				        stack.push( {index:index, values:values, board: oldBoard})
                        this.put (board, index, myValue)
			        }
		        }
                //we're in an invalid state; back to last choice
		        do{
                    var undo = stack.pop()
                    // if (undo && undo.values.size == 0) console.log( "unstacking")
                } while(undo && undo.values.size == 0) //unstack all the finished alternatives
                if (undo === undefined  ) { //options exhausted
                    //console.log("Can't be solved")
                    return null
                }                
                board = undo.board
		        let myValue = this.pickOne(undo.values)
                this.put (board, undo.index, myValue)
		        stack.push(undo) //in case options are not exausted for this place
	        }
	        return board
        },
        isUnique(someBoard, solution){
            //backtrack solver (check every solution version)
            let board = someBoard.map( (x)=> (this.isValid(x) ? x : new Set(x) ) ), //2 level array clone 
                stack = [] //private undo stack
            if (solution == null) return false

	        do{
		        while(this.isSolvable(board) && !this.isSolved(board)) {
                    let min=10
                    let index =-1
                    for (let i=0 ; i < 81 ; i++){
                        //select next index                        
                        if ( !this.isValid(board[i] )) {
                            if (board[i] != undefined && board[i].size < min ){
                                min = board[i].size
                                index = i
                            }
                        }
                    }
                    if (min == 1){
                        //if there's only one value possible just put it in
                        this.put (board, index, [...board[index]][0])
			        }else{
                        //if there's more than one possible values, stack the state and use the next
				        let values = new Set( board[index] )
                        let myValue = this.pickOne( values )
                        let oldBoard = board.map( (x) => (this.isValid(x) ? x : new Set(x) ) )
				        stack.push( {index:index, values:values, board: oldBoard})
                        this.put (board, index, myValue)
			        }
		        }
                if (this.isSolved(board)){
                    for (let i =0; i<81;i++){
                        if (board[i]!=solution[i]) return false
                    }
                }
                //back to last choice
		        do{
                    var undo = stack.pop() //let it hoist
                }while(undo && undo.values.size==0) //unstack all the finished alternatives
                if (undo === undefined ) { //options exhausted
                    return this.isSolved(board) // we've checked everything and didn't bailed yet
                }                
                board = undo.board
                let myValue = this.pickOne( undo.values )
                this.put (board, undo.index, myValue)
		        stack.push(undo)
	        } while(stack.length != 0)
            return true
        },
        removeRandomOne(board){
            let candidates = new Set()
            for (let i = 0 ; i< board.length ; i++){
                if ( this.isValid(board[i]) ) {
                    candidates.add(i)
                }
            }
            let index = this.pickOne(candidates)
            this.remove(board, index)
            return index
        },
        showHint(board){
            let solvable = true;
            let index = undefined
            for (let i = 0;i<81;i++){
                if (!this.isValid(board[i]) && board[i].size===0) solvable=false //solvable?
		        if (!this.isValid(board[i]) && board[i].size===1) index=i;
	        }
            if (!solvable){
                alert("Not solvable")
            }
            if (index >=0 ){
                this.hint = index
                setTimeout( () => this.hint = -1 , 4000 )
                //console.log("hint: ",index)
            }
        }        
    },
    watch: watch
})

if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('worker.js').then(function(registration) {
            // Registration was successful
            console.log('ServiceWorker registration successful with scope: ', registration.scope);
        }, function(err) {
            // registration failed :(
            console.log('ServiceWorker registration failed: ', err);
        });
    });
}



